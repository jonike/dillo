/* UI Stuff */
var global_container = document.getElementById('app-main');

// Set the overall height of the page
// Used by containerResizeY and toggleNavRefine
function setAppHeight(height){

	if (typeof height !== 'undefined'){
		$('#app-main, #col_main, #col_right').css({
			'height': height + 'px',
			'max-height': height + 'px'
		});
	}
}


function containerResizeY(window_height){

	var height = window_height - global_container.offsetTop;
	var header_height = $('.d-header').height();

	if (isMobile()){
		height = height - header_height;
	}

	setAppHeight(height);
}

$(window).on("load resize",function(){
	containerResizeY(window.innerHeight);
});


// Make URLs shorter, just a cosmetic change
function shortenUrl(url){

	if (typeof url !== 'undefined')
		url = url.replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0];

	return url;
}


// Utility for delaying a function call (used to throttle keydown events)
var delay = (function () {
	var timer = 0;
	return function (callback, ms) {
		clearTimeout(timer);
		timer = setTimeout(callback, ms);
	};
})();


// Clicking on this class will display the dropdown-menu inside
$(document).on('click', 'body .wgt-dropdown-toggle', function(e){
	$(this)
		.toggleClass('active')
		.find('.dropdown-menu')
		.toggleClass('active');
});


// Context Workflow
// Save current context as prev-context and set new one
function setContext(context_type){
	ProjectUtils.setProjectAttributes({prevContext: ProjectUtils.context()});
	ProjectUtils.setProjectAttributes({context: context_type});
}

// Set previous context as current
function unsetPreviousContext(){

	var currContext = ProjectUtils.context();
	var previousContext = $('body').attr('data-prev-context');

	if (previousContext){
		ProjectUtils.setProjectAttributes({prevContext: currContext });
		ProjectUtils.setProjectAttributes({context: previousContext });
	}
}


// Fullscreen Workflow
function enterFullscreen(){
	$('a.wgt-toggle-fullscreen').addClass('active');
	$('#col_right').addClass('fullscreen');

	setContext("post-fullscreen");
}

function exitFullscreen(){
	$('a.wgt-toggle-fullscreen').removeClass('active');
	$('#col_right').removeClass('fullscreen');

	// Remove parameters from the url
	var url = location.href.split("?")[0];
	window.history.pushState('object', document.title, url);

	unsetPreviousContext();

	if ($('body').hasClass('posts-index')){
		setContext("posts-index");
	} else if ($('body').hasClass('post-edit')) {
		setContext("post-edit");
	}

	if (isMobile()){
		$('#list-item').empty();
	}
}

function toggleFullscreen(){
	if (ProjectUtils.context() == 'post-fullscreen'){
		exitFullscreen();
	} else {
		enterFullscreen();
	}

}

$(document).on('click', 'body .js-toggle-fullscreen', function(){
	toggleFullscreen();

	ga('send', 'event', 'ui', 'fullscreen-toggle', $(this).attr('class'));
});


// Submit Dialog Workflow
function enterSubmitDialog(){

	// If not logged in, don't even bother
	if (!isAuthenticated()){
		ga('send', 'event', 'ui', 'dialog-open-not-logged-in');
		return window.location.href = '/login';
	}

	appOverlayClear();

	$('#app-overlay')
		.addClass('active submit')
		.html('\
			<div class="overlay-background"></div>\
			<div class="dialog-box"></div>\
		');

	var url = '/c/' + ProjectUtils.projectUrl() + '/post/link?embed=1';

	$.get(url, function(data) {
		$('.dialog-box').html(data);

		ga('send', 'event', 'ui', 'dialog-open');
	});

	setContext("post-submit-overlay");

	Mousetrap.unbind('f');
}

function exitSubmitDialog(){
	appOverlayClear();
	unsetPreviousContext();

	initializeShortcuts();
}

function toggleSubmitDialog(){
	if (ProjectUtils.context() == 'post-submit-overlay'){
		exitSubmitDialog();
	} else {
		enterSubmitDialog();
	}
}

$('.wgt-toggle-submit').on('click', function(){
	toggleSubmitDialog();
});


// UI Helpers
function appOverlayClear(){
	$('#app-overlay')
		.removeAttr('class')
		.html('');
}

$('#app-overlay').on('click', function(){
	if ($(this).hasClass('preview')){
		appOverlayClear();
	}
});

/*
 * Swap the theme based on cookies
 * Swapping also happens on load, check layout.pug head
*/
function themeSwap(){

	if (Cookies.get('theme') == 'light'){

		// Enable/disable CSS links, marking dark as disabled and the default as enabled
		document.getElementsByTagName("link").item(3).disabled = false;
		document.getElementsByTagName("link").item(4).disabled = true;

		// If cookie exists, delete it so next time it loads the light theme
		Cookies.remove('theme');

	} else {

		// Enable/disable CSS links, marking default as disabled and dark as enabled
		document.getElementsByTagName("link").item(4).disabled = false;
		document.getElementsByTagName("link").item(3).disabled = true;

		// If a cookie for the dark theme doesn't exist, create it and save it for a year
		Cookies.set('theme', 'light', { expires: 365 });
	}
}

// Theme toggle button
$('.theme-toggle').on('click', function(e){
	e.preventDefault();
	themeSwap();
});


// Mobile Navigation
function toggleNavRefine(){

	var header_height = $('.d-header').height();
	var col_main = document.getElementById('col_main');
	var height = window.innerHeight - header_height;
	var offset = header_height;

	$('.btn-group.submit').toggle();
	$('.d-header-toggle-nav').toggleClass('active');
	$('.d-header-action.refine').toggleClass('active');
	$('#col_main, #col_right').toggleClass('nav-refine-expanded');


	if ($('.d-header-action.refine').hasClass('active')){
		offset = $('.d-header').height() + $('.d-header-action.refine').height() + 12;
		height = window.innerHeight - col_main.offsetTop;
	}

	$('#col_main, #col_right').css('top', offset);

	setAppHeight(height);
}


$('.d-header-toggle-nav').on('click', function(){
	toggleNavRefine();
});

function viewPostMobile(){
	enterFullscreen();

	if ($('.d-header-action.refine').hasClass('active')){
		toggleNavRefine();
	}
}


// Toggle Communities List
$('.d-header-logo').on('click', function(e){
	e.preventDefault();

	$('.d-communities').toggleClass('active');
});


// Initialize Shortcuts
function initializeShortcuts(){
	Mousetrap.bind('f', toggleFullscreen);
	Mousetrap.bind(['s', 'shift+a'], toggleSubmitDialog);

	Mousetrap.bind('esc', function(e) {
		if (ProjectUtils.context() == 'post-submit-overlay'){
			exitSubmitDialog();
		} else if (ProjectUtils.context() == 'post-fullscreen'){
			exitFullscreen();
		}
	});
}

initializeShortcuts();


// Loading strip on the top of the page
$(document).ajaxStart(function(){
	$('#app-loader').addClass('active');
});

$(document).ajaxStop(function(){
	$('#app-loader').removeClass('active');
});


// Check for the 'logged-in' class on body
function isAuthenticated(){
	return $('body').hasClass('logged-in');
}

function isMobile(){
	return (/Mobi/.test(navigator.userAgent));
}
