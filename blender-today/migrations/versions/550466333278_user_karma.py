"""user karma

Revision ID: 550466333278
Revises: 544ae4180eb
Create Date: 2015-02-24 01:46:29.951315

"""

# revision identifiers, used by Alembic.
revision = '550466333278'
down_revision = '544ae4180eb'

from alembic import op
import sqlalchemy as sa


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.create_table('user_karma',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('positive', sa.Integer(), nullable=True),
    sa.Column('negative', sa.Integer(), nullable=True),
    sa.Column('value', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    ### end Alembic commands ###


def downgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('user_karma')
    ### end Alembic commands ###
