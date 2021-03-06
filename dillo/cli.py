"""Commandline interface for Dillo."""

import logging

from flask import current_app
from flask_script import Manager

from pillar.api.utils import authentication
from pillar.cli import manager

import dillo.setup
import dillo.api.posts.rating

log = logging.getLogger(__name__)

manager_dillo = Manager(current_app, usage="Perform Dillo operations")

manager.add_command("dillo", manager_dillo)


@manager_dillo.command
def setup_db(admin_email):
    """Extends Pillar setup_db."""
    from pillar.cli.setup import setup_db as pillar_setup_db
    # Define the dillo_user_main group, which is automatically assigned
    # after every user creation.
    g = {'name': 'dillo_user_main'}
    current_app.post_internal('groups', g)
    # Execute the default user creation
    pillar_setup_db(admin_email)


@manager_dillo.command
@manager_dillo.option('-r', '--replace', dest='replace', action='store_true', default=False)
def setup_for_dillo(project_url, replace=False):
    """Adds Dillo node types to the project.

    Use --replace to replace pre-existing Dillo node types
    (by default already existing Dillo node types are skipped).
    """

    authentication.force_cli_user()
    dillo.setup.setup_for_dillo(project_url, replace=replace)


@manager_dillo.command
def index_nodes_rebuild():
    """Clear all nodes, update settings and reindex all posts."""

    from dillo.api.posts.hooks import algolia_index_post_save

    nodes_index = current_app.algolia_index_nodes

    log.info('Dropping index: {}'.format(nodes_index))
    nodes_index.clear_index()
    index_nodes_update_settings()

    db = current_app.db()
    nodes_dillo_posts = db['nodes'].find({
        '_deleted': {'$ne': True},
        'node_type': 'dillo_post',
        'properties.status': 'published',
    })

    log.info('Reindexing all nodes')
    for post in nodes_dillo_posts:
        algolia_index_post_save(post)


@manager_dillo.command
def process_posts(community_name):
    """Manually trigger pre-update hooks."""
    from flask import g
    from pillar.auth import UserClass
    from dillo.api.posts.hooks import process_picture_oembed, before_replacing_post
    from dillo.setup import _get_project
    project = _get_project(community_name)

    nodes_collection = current_app.db()['nodes']
    user_collection = current_app.db()['users']
    nc = nodes_collection.find({
        'node_type': 'dillo_post',
        'properties.status': 'published',
        'project': project['_id'],
    })

    for n in nc:
        # Log in as doc user
        user_doc = user_collection.find_one({'_id': n['user']})
        u = UserClass.construct(user_doc['_id'], user_doc)
        g.current_user = u

        n_id = n['_id']
        print(f'Processing node {n_id}')
        process_picture_oembed(n, n)
        before_replacing_post(n, n)
        nodes_collection.find_one_and_replace({'_id': n_id}, n)


@manager_dillo.command
def index_nodes_update_settings():
    import copy
    """Configure indexing backend as required by the project"""
    nodes_index = current_app.algolia_index_nodes
    nodex_index_replicas = current_app.config['ALGOLIA_INDEX_NODES_REPLICAS']

    # Create index name by combining the base Nodes index with the replica extension
    for k, v in nodex_index_replicas.items():
        nodex_index_replicas[k] = f"{nodes_index.index_name}{v}"

    shared_settings = {
        'searchableAttributes': [
            'name',
            'content',
        ],
        'attributesForFaceting': [
            'searchable(tags)',
            'project._id',
        ],
    }

    # Configure indexing for additional properties
    for k, v in current_app.config['POST_ADDITIONAL_PROPERTIES'].items():
        indexing_settings = v.get('indexing')
        if not indexing_settings:
            continue
        if 'searchable' in indexing_settings and indexing_settings['searchable']:
            shared_settings['searchableAttributes'].append(k)
        if 'faceting' in indexing_settings:
            if indexing_settings['faceting'] == 'searchable':
                searchable_str = f'searchable({k})'
            else:
                searchable_str = k
            shared_settings['attributesForFaceting'].append(searchable_str)

    # Automatically creates index if it does not exist
    index_settings = copy.deepcopy(shared_settings)
    index_settings.update({
        'customRanking': [
            'desc(hot)',
            'desc(created)',
        ],
        'replicas': [v for k, v in nodex_index_replicas.items()]
        })
    nodes_index.set_settings(index_settings)

    for k, v in nodex_index_replicas.items():
        replica_settings = copy.deepcopy(shared_settings)
        replica_settings.update({
            'customRanking': [
                f"desc({k})",
            ],
        })

        index_nodes_replica = nodes_index.client.init_index(v)
        index_nodes_replica.set_settings(replica_settings)


@manager_dillo.command
def reset_users_karma():
    """Recalculate the users karma"""
    dillo.api.posts.rating.rebuild_karma()


@manager_dillo.command
def attach_post_additional_properties():
    """If POST_ADDITIONAL_PROPERTIES exists, extend dillo_post node type."""

    if not current_app.config['POST_ADDITIONAL_PROPERTIES']:
        log.info('No POST_ADDITIONAL_PROPERTIES was defined')
        return
    # Create a dict with the additional properties ready to be appended to the doc
    db = current_app.db()
    for k, v in current_app.config['POST_ADDITIONAL_PROPERTIES'].items():
        additional_properties = {}
        doc_key = f'node_types.$.dyn_schema.{k}'
        additional_properties[doc_key] = v['schema']
        for project_url in v['projects']:
            u = db['projects'].update_one({
                'node_types.name': 'dillo_post',
                '_deleted': {'$ne': True},
                'url': project_url},
                {'$set': additional_properties})
            log.info('Updated %s document' % u.modified_count)
