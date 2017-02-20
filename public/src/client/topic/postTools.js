'use strict';

/* globals define, app, ajaxify, bootbox, socket, templates, utils, config */

define('forum/topic/postTools', [
	'share',
	'navigator',
	'components',
	'translator',
	'forum/topic/votes',
	'forum/topic/move-post'
], function (share, navigator, components, translator, votes, movePost) {

	var PostTools = {};

	var staleReplyAnyway = false;

	PostTools.init = function (tid) {
		staleReplyAnyway = false;

		renderMenu();

		addPostHandlers(tid);

		share.addShareHandlers(ajaxify.data.titleRaw);

		votes.addVoteHandler();

		PostTools.updatePostCount(ajaxify.data.postcount);
	};

	function renderMenu() {
		$('[component="topic"]').on('show.bs.dropdown', '.moderator-tools', function () {
			var $this = $(this);
			var dropdownMenu = $this.find('.dropdown-menu');
			if (dropdownMenu.html()) {
				return;
			}
			var postEl = $this.parents('[data-pid]');
			var pid = postEl.attr('data-pid');
			var index = parseInt(postEl.attr('data-index'), 10);

			socket.emit('posts.loadPostTools', {pid: pid, cid: ajaxify.data.cid}, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}
				data.posts.display_move_tools = data.posts.display_move_tools && index !== 0;

				templates.parse('partials/topic/post-menu-list', data, function (html) {
					translator.translate(html, function (html) {
						dropdownMenu.html(html);
						$(window).trigger('action:post.tools.load');
					});
				});
			});
		});
	}

	PostTools.toggle = function (pid, isDeleted) {
		var postEl = components.get('post', 'pid', pid);

		postEl.find('[component="post/quote"], [component="post/bookmark"], [component="post/reply"], [component="post/flag"], [component="user/chat"]')
			.toggleClass('hidden', isDeleted);

		postEl.find('[component="post/delete"]').toggleClass('hidden', isDeleted);
		postEl.find('[component="post/restore"]').toggleClass('hidden', !isDeleted);
		postEl.find('[component="post/purge"]').toggleClass('hidden', !isDeleted);

		postEl.find('[component="post/tools"] .dropdown-menu').html('');
	};

	PostTools.updatePostCount = function (postCount) {
		var postCountEl = components.get('topic/post-count');
		postCountEl.html(postCount).attr('title', postCount);
		utils.makeNumbersHumanReadable(postCountEl);
		navigator.setCount(postCount);
	};

	function addPostHandlers(tid) {
		var postContainer = components.get('topic');

		postContainer.on('click', '[component="post/quote"]', function () {
			onQuoteClicked($(this), tid);
		});

		postContainer.on('click', '[component="post/reply"]', function () {
			onReplyClicked($(this), tid);
		});

		$('.topic').on('click', '[component="topic/reply"]', function () {
			onReplyClicked($(this), tid);
		});

		$('.topic').on('click', '[component="topic/reply-as-topic"]', function () {
			translator.translate('[[topic:link_back, ' + ajaxify.data.titleRaw + ', ' + config.relative_path + '/topic/' + ajaxify.data.slug + ']]', function (body) {
				$(window).trigger('action:composer.topic.new', {
					cid: ajaxify.data.cid,
					body: body
				});
			});
		});

		postContainer.on('click', '[component="post/bookmark"]', function () {
			return bookmarkPost($(this), getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/upvote"]', function () {
			return votes.toggleVote($(this), '.upvoted', 'posts.upvote');
		});

		postContainer.on('click', '[component="post/downvote"]', function () {
			return votes.toggleVote($(this), '.downvoted', 'posts.downvote');
		});

		postContainer.on('click', '[component="post/vote-count"]', function () {
			votes.showVotes(getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/flag"]', function () {
			var pid = getData($(this), 'data-pid');
			var username = getData($(this), 'data-username');
			var userslug = getData($(this), 'data-userslug');
			require(['forum/topic/flag'], function (flag) {
				flag.showFlagModal(pid, username, userslug);
			});
		});

		postContainer.on('click', '[component="post/edit"]', function () {
			var btn = $(this);

			var timestamp = parseInt(getData(btn, 'data-timestamp'), 10);
			var postEditDuration = parseInt(ajaxify.data.postEditDuration, 10);

			if (checkDuration(postEditDuration, timestamp, 'post-edit-duration-expired')) {
				$(window).trigger('action:composer.post.edit', {
					pid: getData(btn, 'data-pid')
				});
			}
		});

		postContainer.on('click', '[component="post/delete"]', function () {
			var btn = $(this);
			var timestamp = parseInt(getData(btn, 'data-timestamp'), 10);
			var postDeleteDuration = parseInt(ajaxify.data.postDeleteDuration, 10);
			if (checkDuration(postDeleteDuration, timestamp, 'post-delete-duration-expired')) {
				togglePostDelete($(this), tid);
			}
		});

		function checkDuration(duration, postTimestamp, languageKey) {
			if (!ajaxify.data.privileges.isAdminOrMod && duration && Date.now() - postTimestamp > duration * 1000) {
				var numDays = Math.floor(duration / 86400);
				var numHours = Math.floor((duration % 86400) / 3600);
				var numMinutes = Math.floor(((duration % 86400) % 3600) / 60);
				var numSeconds = ((duration % 86400) % 3600) % 60;
				var msg = '[[error:' + languageKey + ', ' + duration + ']]';
				if (numDays) {
					if (numHours) {
						msg = '[[error:' + languageKey + '-days-hours, ' + numDays + ', ' + numHours + ']]';
					} else {
						msg = '[[error:' + languageKey + '-days, ' + numDays + ']]';
					}
				} else if (numHours) {
					if (numMinutes) {
						msg = '[[error:' + languageKey + '-hours-minutes, ' + numHours + ', ' + numMinutes + ']]';
					} else {
						msg = '[[error:' + languageKey + '-hours, ' + numHours + ']]';
					}
				} else if (numMinutes) {
					if (numSeconds) {
						msg = '[[error:' + languageKey + '-minutes-seconds, ' + numMinutes + ', ' + numSeconds + ']]';
					} else {
						msg = '[[error:' + languageKey + '-minutes, ' + numMinutes + ']]';
					}
				}
				app.alertError(msg);
				return false;
			}
			return true;
		}

		postContainer.on('click', '[component="post/restore"]', function () {
			togglePostDelete($(this), tid);
		});

		postContainer.on('click', '[component="post/purge"]', function () {
			purgePost($(this), tid);
		});

		postContainer.on('click', '[component="post/move"]', function () {
			movePost.openMovePostModal($(this));
		});

		postContainer.on('click', '[component="post/chat"]', function () {
			openChat($(this));
		});
	}

	function onReplyClicked(button, tid) {
		var selectedText = getSelectedText(button);

		showStaleWarning(function () {
			var username = getUserName(button);
			if (getData(button, 'data-uid') === '0' || !getData(button, 'data-userslug')) {
				username = '';
			}

			var toPid = button.is('[component="post/reply"]') ? getData(button, 'data-pid') : null;

			if (selectedText) {
				$(window).trigger('action:composer.addQuote', {
					tid: tid,
					slug: ajaxify.data.slug,
					index: getData(button, 'data-index'),
					pid: toPid,
					topicName: ajaxify.data.titleRaw,
					username: username,
					text: selectedText
				});
			} else {
				$(window).trigger('action:composer.post.new', {
					tid: tid,
					pid: toPid,
					topicName: ajaxify.data.titleRaw,
					text: username ? username + ' ' : ''
				});
			}
		});
	}

	function onQuoteClicked(button, tid) {
		var selectedText = getSelectedText(button);

		showStaleWarning(function () {

			function quote(text) {
				$(window).trigger('action:composer.addQuote', {
					tid: tid,
					slug: ajaxify.data.slug,
					index: getData(button, 'data-index'),
					pid: pid,
					username: username,
					topicName: ajaxify.data.titleRaw,
					text: text
				});
			}

			var username = getUserName(button);
			var pid = getData(button, 'data-pid');

			if (selectedText) {
				return quote(selectedText);
			}
			socket.emit('posts.getRawPost', pid, function (err, post) {
				if (err) {
					return app.alertError(err.message);
				}

				quote(post);
			});
		});
	}

	function getSelectedText(button) {
		var selectionText = '';
		var selection = window.getSelection ? window.getSelection() : document.selection.createRange();
		var content = button.parents('[component="post"]').find('[component="post/content"]').get(0);

		if (selection && selection.containsNode && content && selection.containsNode(content, true)) {
			var bounds = document.createRange();
			bounds.selectNodeContents(content);
			var range = selection.getRangeAt(0).cloneRange();
			if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
				range.setStart(bounds.startContainer, bounds.startOffset);
			}
			if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
				range.setEnd(bounds.endContainer, bounds.endOffset);
			}
			bounds.detach();
			selectionText = range.toString();
			range.detach();
		}
		return selectionText;
	}

	function bookmarkPost(button, pid) {
		var method = button.attr('data-bookmarked') === 'false' ? 'posts.bookmark' : 'posts.unbookmark';

		socket.emit(method, {
			pid: pid,
			room_id: app.currentRoom
		}, function (err) {
			if (err) {
				app.alertError(err.message);
			}
		});

		return false;
	}

	function getData(button, data) {
		return button.parents('[data-pid]').attr(data);
	}

	function getUserName(button) {
		var username = '';
		var post = button.parents('[data-pid]');

		if (button.attr('component') === 'topic/reply') {
			return username;
		}

		if (post.length) {
			username = post.attr('data-username').replace(/\s/g, '-');
		}
		if (post.length && post.attr('data-uid') !== '0') {
			username = '@' + username;
		}

		return username;
	}

	function togglePostDelete(button, tid) {
		var pid = getData(button, 'data-pid');
		var postEl = components.get('post', 'pid', pid);
		var action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

		postAction(action, pid, tid);
	}

	function purgePost(button, tid) {
		postAction('purge', getData(button, 'data-pid'), tid);
	}

	function postAction(action, pid, tid) {
		translator.translate('[[topic:post_' + action + '_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('posts.' + action, {
					pid: pid,
					tid: tid
				}, function (err) {
					if (err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	function openChat(button) {
		var post = button.parents('[data-pid]');

		app.newChat(post.attr('data-uid'));
		button.parents('.btn-group').find('.dropdown-toggle').click();
		return false;
	}

	function showStaleWarning(callback) {
		if (staleReplyAnyway || ajaxify.data.lastposttime >= (Date.now() - (1000 * 60 * 60 * 24 * ajaxify.data.topicStaleDays))) {
			return callback();
		}

		translator.translate('[[topic:stale.warning]]', function (translated) {
			var warning = bootbox.dialog({
					title: '[[topic:stale.title]]',
					message: translated,
					buttons: {
						reply: {
							label: '[[topic:stale.reply_anyway]]',
							className: 'btn-link',
							callback: function () {
								staleReplyAnyway = true;
								callback();
							}
						},
						create: {
							label: '[[topic:stale.create]]',
							className: 'btn-primary',
							callback: function () {
								translator.translate('[[topic:link_back, ' + ajaxify.data.title + ', ' + config.relative_path + '/topic/' + ajaxify.data.slug + ']]', function (body) {
									$(window).trigger('action:composer.topic.new', {
										cid: ajaxify.data.cid,
										body: body
									});
								});
							}
						}
					}
				});

			warning.modal();
		});
	}

	return PostTools;
});
