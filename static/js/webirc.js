"use strict";

var webircApp = angular.module('webircApp', []);

webircApp.directive('loginbox', function($rootScope) {
	return {
		scope: true,
		link: function(scope) {
			scope.login = function() {
				$rootScope.sendToGateway('Login', {
					username: scope.username,
					password: scope.password
				});

				if (window.Notification && window.Notification.permission !== 'granted') {
					window.Notification.requestPermission();
				}
			};

			scope.passwordKeyDown = function(event) {
				if (event.keyCode === 13) {
					scope.login();
				}
			}
		}
	};
});

webircApp.directive('focusKey', function($timeout) {
	return {
		link: function(scope, element, attrs) {
			scope.$on('FocusKey', function(e, focusKey) {
				if (focusKey === attrs.focusKey) {
					$timeout(function() {
						element[0].focus();
					});
				}
			});
		}
	};
});

// TODO: this scrolling code needs to be redesigned
webircApp.directive('resizeMaincell', function($rootScope) {
	return {
		controller: function($scope, $element, $timeout) {
			var chatlogDiv = $element[0];

			$scope.delayedScroll = this.delayedScroll = function(force) {
				function doScroll(force) {
					if (chatlogDiv.lastScrollTopTarget && chatlogDiv.scrollTop >= chatlogDiv.lastScrollTopTarget - 30) {
						// if they scroll near the bottom
						chatlogDiv.scrollLock = false;
					}
					else if (chatlogDiv.lastScrollTop && chatlogDiv.scrollTop < chatlogDiv.lastScrollTop) {
						// if the user scrolled up the chat log
						chatlogDiv.scrollLock = true;
					}

					var chatlogDivJQ = $(chatlogDiv);

					var scrollTopTarget = getScrollTopTarget(chatlogDivJQ);

					function getScrollTopTarget(theDiv) {
						// scrollHeight of 0 means the div is out of view, so we check for that case to avoid returning a negative
						if (theDiv[0].scrollHeight > 0) {
							return theDiv[0].scrollHeight // start with the total scroll height
								- theDiv.outerHeight() // subtract (height + padding + border)
								+ parseInt(theDiv.css('border-top-width')) // readd the top border
								+ parseInt(theDiv.css('border-bottom-width')) // readd the bottom border
						} else {
							return 0;
						}
					}

					if (force) {
						chatlogDiv.scrollLock = false;
					}

					if (!chatlogDiv.scrollLock)
					{
						chatlogDiv.scrollTop = scrollTopTarget;
					}

					chatlogDiv.lastScrollTop = chatlogDiv.scrollTop;
					chatlogDiv.lastScrollTopTarget = scrollTopTarget;
				}

				$timeout(doScroll.bind(null, force));
			}

			this.resetScroll = function() {
				delete chatlogDiv.lastScrollTop;
			}
		},
		link: function(scope, element, attrs) {
			var getResizeParams = function() {
				var bodyOverflowY = 'hidden';

				var maincellHeight = getTargetHeightForMaincell(scope.chatboxHeight);

				if (!maincellHeight) {
					maincellHeight = 0;
				}

				if (maincellHeight < 300) {
					maincellHeight = 300;
					// if the scrollbars are needed, enable them
					bodyOverflowY = 'auto';
				}

				return {
					maincellHeight: maincellHeight,
					fullHeight: $(window).height(),
					bodyOverflowY: bodyOverflowY
				};
			}

			scope.$watch(getResizeParams, function(newVal) {
				scope.maincellHeight = newVal.maincellHeight + 'px';
				scope.fullHeight = newVal.fullHeight + 'px';

				scope.delayedScroll();
			}, true);

			var entity = scope.$eval(attrs.resizeMaincell);

			$rootScope.$watch('state.activeEntityId', function(newActiveEntityId) {
				if (newActiveEntityId === entity.entityId) {
					// if this window is becoming active, scroll to the bottom
					scope.delayedScroll(true);
				}
			}, true);

			angular.element(window).bind('resize orientationchange', function() {
				// we need to rerun getResizeParams on resize
				scope.$apply();
			});
		}
	}
});

webircApp.directive('addserverbutton', function($rootScope) {
	return {
		compile: function(element, attr) {
			return function($scope, $element, $attr) {
				var trElement = angular.element('<div/>').addClass('tablerow');
				var maincellElement = angular.element('<div/>').addClass('addserverbutton_maincell');
				var rightcellElement = angular.element('<div/>').addClass('sidebutton_iconcell');

				trElement.append(maincellElement);
				trElement.append(rightcellElement);

				$element.append(trElement);

				$scope.$watch($attr.hoverLabel, function(newHoverLabel) {
					if (typeof newHoverLabel === 'string') {
						rightcellElement[0].title = newHoverLabel;
					}
				}, true);

				var eventInner = angular.element('<div/>').addClass('sidebutton_iconinner_addserver');

				rightcellElement.append(eventInner);

				rightcellElement.on('mousedown', function() {
					$scope.requestAddServer();
				});
			}
		}
	}
});

webircApp.directive('windowbutton', function($rootScope) {
	return {
		compile: function(element, attr) {
			return function($scope, $element, $attr) {
				function setElementHoverLabel(el, title) {
					el[0].title = title;
				}

				var alertCount = 0;
				var eventCount = 0;
				var entityId = null;
				var isCurrent = false;
				var isMouseOver = false;
				var updateView = null;

				// the elements
				var trElement = angular.element('<div/>').addClass('tablerow');
				var maincellElement = angular.element('<div/>').addClass('windowbutton_maincell');
				var optionscellElement = null;
				var rightcellElement = angular.element('<div/>').addClass('sidebutton_iconcell');

				trElement.append(maincellElement);

				if ('optionsbutton' in $attr) {
					optionscellElement = angular.element('<div/>').addClass('sidebutton_iconcell_displaynone');
					optionscellElement.append(angular.element('<div/>').addClass('sidebutton_iconinner_options'));

					setElementHoverLabel(optionscellElement, 'Options');

					optionscellElement.on('mousedown', function() {
						$scope.$eval($attr['optionsbutton']);
					});

					trElement.append(optionscellElement);
				}

				trElement.append(rightcellElement);

				$element.append(trElement);

				$element.on('mouseenter', function() {
					isMouseOver = true;

					updateView();
				});

				$element.on('mouseleave', function() {
					isMouseOver = false;

					updateView();
				});

				// attributes
				var label = null;
				var altLabel = '';

				var updateLabel = function() {
					maincellElement.removeClass('windowbutton_alttitle');

					if (!label) {
						maincellElement.addClass('windowbutton_alttitle');
					}

					maincellElement.text(label || altLabel);
				}

				$scope.$watch($attr.label, function(newLabel) {
					if (typeof newLabel === 'string' && newLabel.length > 0) {
						label = newLabel;
					} else {
						label = null;
					}

					updateLabel();
				}, true);

				if ('altLabel' in $attr) {
					$scope.$watch($attr.altLabel, function(newAltLabel) {
						altLabel = newAltLabel;

						updateLabel();
					}, true);
				}

				$scope.$watch($attr.hoverLabel, function(newHoverLabel) {
					if (typeof newHoverLabel === 'string') {
						setElementHoverLabel(maincellElement, newHoverLabel);
					}
				}, true);

				$scope.$watch($attr.entity + '.entityId', function(newEntityId) {
					entityId = newEntityId;

					updateView();
				});

				function onMainClick() {
					$scope.requestSetActiveEntity(entityId);
				}

				maincellElement.on('mousedown', function() {
					onMainClick();
				});

				rightcellElement.on('mousedown', function() {
					if (isCurrent) {
						// if current, the right cell contains the close button
						$scope.requestCloseWindow(entityId);
					} else {
						// otherwise treat it the same as clicking on the label
						onMainClick();
					}
				});

				$scope.$watch($attr.entity + '.numEvents', function(newEventCount) {
					eventCount = newEventCount;

					updateView();
				});

				$scope.$watch($attr.entity + '.numAlerts', function(newAlertCount) {
					alertCount = newAlertCount;

					updateView();
				});

				$rootScope.$watch('state.activeEntityId', function(newActiveEntityId) {
					isCurrent = (entityId === newActiveEntityId);

					updateView();
				});

				updateView = function() {
					function setOptionsCellVisible(visible) {
						if (optionscellElement) {
							// reset optionscellElement
							optionscellElement.removeClass('sidebutton_iconcell');

							if (visible) {
								optionscellElement.addClass('sidebutton_iconcell');
							}
						}
					}

					function setRightCellContent(content) {
						// reset rightcellElement
						rightcellElement.children().remove();

						if (content) {
							rightcellElement.append(content);
						}
					}

					// reset current
					$element.removeClass('windowbutton_current');

					// apply current
					if (isCurrent) {
						$element.addClass('windowbutton_current');
					}

					// apply optionscellElement
					setOptionsCellVisible(isCurrent && isMouseOver);

					// apply rightcell
					if (isCurrent) {
						var closeInner = angular.element('<div/>').addClass('sidebutton_iconinner_close');

						setElementHoverLabel(closeInner, 'Close');

						setRightCellContent(closeInner);
					} else if (alertCount > 0) {
						var alertInner = angular.element('<div/>').addClass('sidebutton_iconinner_alert');

						alertInner.text(alertCount < 10 ? alertCount : '9+');

						setElementHoverLabel(alertInner, alertCount + ' new alert' + (alertCount > 1 ? 's' : ''));

						setRightCellContent(alertInner);
					} else if (eventCount > 0) {
						var eventInner = angular.element('<div/>').addClass('sidebutton_iconinner_event');

						eventInner.text(eventCount < 10 ? eventCount : '9+');

						setElementHoverLabel(eventInner, eventCount + ' new event' + (eventCount > 1 ? 's' : ''));

						setRightCellContent(eventInner);
					} else {
						setRightCellContent(null);
					}
				}

				updateView();
			}
		}
	}
});

webircApp.directive('chatlog', function() {
	return {
		require: '^resizeMaincell',
		compile: function(element, attr) {
			return function($scope, $element, $attr, resizeMaincellCtrl) {
				var server = null;

				$scope.$watch($attr.server, function(newServer) {
					server = newServer;
				});

				var lastLen = 0;

				$scope.$watchCollection($attr.activityLog, function(activityLog) {
					function convertLinksForDomTreeAng(root, server) {
						convertLinksForDomTree(root[0], server);

						return root;
					}

					function appendActivities(activities) {
						activities.forEach(function(activity) {
							$element.append(convertLinksForDomTreeAng(elementFromActivity(activity), server));
						});
					}

					if (activityLog.length > lastLen) {
						// get only the newly-added entries
						var newEntries = activityLog.slice(lastLen);

						// and append them
						appendActivities(newEntries);

						resizeMaincellCtrl.delayedScroll();
					} else {
						// some elements were removed
						// this won't happen often, so we can be lazy and re-generate the entire chatlog
						$element.children().remove();

						appendActivities(activityLog);

						resizeMaincellCtrl.resetScroll();
					}

					lastLen = activityLog.length;
				});
			}
		}
	};

	function oldElementFromActivity(activity) {
		var innerSpan = elementFromActivityNoTime(activity);

		innerSpan[0].title = moment(activity.time * 1000).calendar();

		return angular.element('<div />').addClass('activityblock').append(innerSpan);
	}

	function elementFromActivity(activity) {
		var originNickOrName = sc.utils.originNickOrName;

		var activityHandlers = {
			'ActionMessage': function(activity) {
				var className = 'activity';

				if (activity.mentionMe) {
					className = 'activity_mentionme';
				}
				return fourCol(className, null, colDot('star', getNickColor(originNickOrName(activity.origin))), displayNick(originNickOrName(activity.origin)), ' ' + activity.text);
			},
			'ChannelNotice': function(activity) {
				return fourCol('activity_notice', originNickOrName(activity.origin), colDot('three', null), activity.channelName + ': ' + activity.text);
			},
			'ChatMessage': function(activity) {
				var className = 'activity';

				if (activity.mentionMe) {
					className = 'activity_mentionme';
				}
				return fourCol(className, originNickOrName(activity.origin), colDot('pipe', getNickColor(originNickOrName(activity.origin))), activity.text);
			},
			'Error': function(activity) {
				return fourCol('activity_error', null, colDot('warn', 'red'), activity.text);
			},
			'Info': function(activity) {
				return fourCol('activity_dim', null, colDot('info', null), activity.text);
			},
			'Join': function(activity) {
				return fourCol('activity_join', '', colDot('dot', getNickColor(activity.who.nick)), displayNick(activity.who.nick), ' ', displayHost(), ' joined');
			},
			'Kick': function(activity) {
				var msg = '';
				if (activity.kickMessage) {
					msg = ' (' + activity.kickMessage + ')';
				}
				return fourCol('activity_error', '', colDot('circle', getNickColor(activity.targetNick)), displayNick(activity.targetNick), ' was kicked by', colDot('star', getNickColor(originNickOrName(activity.origin))), displayNick(originNickOrName(activity.origin)), msg);
			},
			'KickMe': function(activity) {
				var msg = '';
				if (activity.kickMessage) {
					msg = ' (' + activity.kickMessage + ')';
				}
				return fourCol('activity_error', '', colDot('warn', 'red'), 'You were kicked by', colDot('star', getNickColor(originNickOrName(activity.origin))), displayNick(originNickOrName(activity.origin)), msg);
			},
			'ModeChange': function(activity) {
				return fourCol('activity_info', 'mode', colDot('three', null), activity.modes + ' ' + activity.modeArgs.join(' '), angular.element('<span />').addClass('dim2').append(' by'), colDot('star', getNickColor(originNickOrName(activity.origin))), displayNick(originNickOrName(activity.origin)));
			},
			'MyActionMessage': function(activity) {
				return fourCol('activity_mychat', null, colDot('star', getNickColor(activity.nick)), displayNick(activity.nick), ' ' + activity.text);
			},
			'MyChatMessage': function(activity) {
				return fourCol('activity_mychat', activity.nick, colDot('pipe', getNickColor(activity.nick)), activity.text);
			},
			'NickChange': function(activity) {
				return fourCol('activity_dim', null, colDot('dot', getNickColor(activity.oldNickname)), displayNick(activity.oldNickname), ' is now known as', colDot('dot', getNickColor(activity.newNickname)), displayNick(activity.newNickname));
			},
			'Notice': function(activity) {
				return fourCol('activity_notice', originNickOrName(activity.origin), colDot('three', null), activity.text);
			},
			'Part': function(activity) {
				return fourCol('activity_part', '', colDot('circle', getNickColor(activity.who.nick)), displayNick(activity.who.nick), ' ', displayHost(), ' left');
			},
			'Quit': function(activity) {
				var msg = '';
				if (activity.quitMessage) {
					msg = ' (' + activity.quitMessage + ')';
				}
				return fourCol('activity_part', '', colDot('circlethin', getNickColor(activity.who.nick)), displayNick(activity.who.nick), ' ', displayHost(), ' quit', msg);
			},
			'SetTopic': function(activity) {
				return fourCol('activity_info', 'topic', colDot('three', null), displayNick(activity.newTopic), displayDim(' by'), colDot('star', getNickColor(originNickOrName(activity.origin))), displayNick(originNickOrName(activity.origin)));
			},
			'Text': function(activity) {
				return basicText('activity', activity.text);
			},
			'Whois': function(activity) {
				return fourCol('activity_whois', null, colDot('info', '#DDD'), activity.text)
			}
		};

		if (activity.type in activityHandlers) {
			return activityHandlers[activity.type](activity);
		} else {
			return basicText('activity', '*** Unsupported activity type: ' + activity.type);
		}

		function basicText(className, text) {
			return angular.element('<div />').addClass('activityblock').append(angular.element('<span />').addClass(className).text(text));
		}

		function fourCol(className, nick, dot, text, text2, text3, text4, text5) {
			var theStuff = angular.element('<div />').addClass('activityblock');

			//todo: learn angular.js and javascript in general
			if (className == 'activity_mentionme') {
				theStuff.addClass('activity_mentionme');
			} else if (className == 'activity_notice') {
				theStuff.addClass('activity_notice');
			} else if (className == 'activity_error') {
				theStuff.addClass('activity_error');
			} else if (className == 'activity_info') {
				theStuff.addClass('activity_info');
			} else if (className == 'activity_dim') {
				theStuff.addClass('activity_dim');
			} else if (className == 'activity_mychat') {
				theStuff.addClass('activity_mychat');
			} else if (className == 'activity_whois') {
				theStuff.addClass('activity_whois');
			} else if (className == 'activity_join') {
				theStuff.addClass('activity_join');
			} else if (className == 'activity_part') {
				theStuff.addClass('activity_part');
			}

			theStuff.append(angular.element('<div />').addClass('colnick').append(nick));
			theStuff.append(dot);
			theStuff.append(angular.element('<div />').addClass('coltext').append(text).append(text2).append(text3).append(text4).append(text5));
			theStuff.append(angular.element('<div />').addClass('coltime').append(moment(activity.time * 1000).format('HH:mm')));

			return theStuff;
		}

		function getNickColor(str) {
			 // str to hash
    	for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));

    	// int/hash to hex
    	for (var i = 0, colour = "#"; i < 3; colour += ("00" + ((hash >> i++ * 8) & 0xFF).toString(16)).slice(-2));

    	return colour;
		}

		function colDot(type, color) {
			var outerDot = angular.element('<div />').addClass('coldot');
			if (type == 'star') {
				return outerDot.append(angular.element('<div />').addClass('star').append('').css('color', color));
			} else if (type == 'dot') {
				return outerDot.append(angular.element('<div />').addClass('dot').css('background-color', color));
			} else if (type == 'pipe') {
				return outerDot.append(angular.element('<div />').addClass('pipe').css('background-color', color));
			} else if (type == 'info') {
				return outerDot.append(angular.element('<div />').addClass('info').append('').css('color', color));
			} else if (type == 'circle') {
				return outerDot.append(angular.element('<div />').addClass('circle').css('border', '2px solid ' + color));
			} else if (type == 'circlethin') {
				return outerDot.append(angular.element('<div />').addClass('circlethin').css('border', '1px solid ' + color));
			} else if (type == 'three') {
				return outerDot.append(angular.element('<div />').addClass('three').append(''));
			} else if (type == 'warn') {
				return outerDot.append(angular.element('<div />').addClass('warn').append(''));
			} else {
				return 'colDot done fucked';
			}
		}

		function displayDim(msg) {
			return angular.element('<span />').addClass('dim3').append(msg);
		}
		function displayNick(msg) {
			return angular.element('<span />').addClass('nick').append(msg);
		}
		function displayHost() {
			return displayDim('(' + activity.who.user + '@' + activity.who.host + ')');
		}
	};
});

webircApp.directive('userlist', function() {
	return {
		scope: true,
		link: function(scope) {
			scope.getUserlistNamePrefix = function(userlistEntry) {

				if ('owner' in userlistEntry) {
					return '~';
				} else if ('admin' in userlistEntry) {
					return '&';
				} else if ('op' in userlistEntry) {
					return '@';
				} else if ('halfop' in userlistEntry) {
					return '%';
				} else if ('voice' in userlistEntry) {
					return '+';
				} else {
					return '';
				}

			};

			scope.getUserlistClass = function(userlistEntry) {
				/*
				if ('owner' in userlistEntry) {
					return 'userlist_color_owner';
				} else if ('admin' in userlistEntry) {
					return 'userlist_color_admin';
				} else if ('op' in userlistEntry) {
					return 'userlist_color_op';
				} else if ('halfop' in userlistEntry) {
					return 'userlist_color_halfop';
				} else if ('voice' in userlistEntry) {
					return 'userlist_color_voice';
				} else {
					return null;
				}
				*/
				return null;
			};
		}
	};
});

webircApp.directive('chatbox', function($rootScope, $timeout) {
	return function(scope, element, attrs) {
		var rawElement = element[0];
		var history = [];
		var currentHistoryId = null;

		var entity = null;

		scope.$watch(attrs.entity, function(newEntity) {
			entity = newEntity;
		});

		element.bind('keydown', function(e) {
			function setCursorPosToEnd() {
				rawElement.selectionStart = rawElement.selectionEnd = element.val().length;
			}

			if (e.keyCode === 13) { // enter
				var lines = element.val().replace(/\r\n/g, '\n').split('\n').filter(function(line) { return (line.length > 0); });

				if (lines.length > 0) {
					lines.forEach(function(line) {
						history.push(line);
					});

					$rootScope.sendToGateway('ChatboxSend', {
						lines: lines,
						exec: !e.shiftKey,
						entityId: entity.entityId
					});
				}

				if (history.length > 40) {
					history = history.slice(10);
				}

				currentHistoryId = null;

				element.val('');

				e.preventDefault();
			} else if (e.keyCode === 38) { // up
				if (currentHistoryId === null) {
					if (rawElement.selectionStart === 0) {
						currentHistoryId = history.length - 1;
					} else {
						// pressing up while not at position 0 will naturally move the cursor up or to position 0
					}
				} else if (currentHistoryId > 0) {
					currentHistoryId--;
				}

				if (currentHistoryId !== null) {
					element.val(history[currentHistoryId]);

					setCursorPosToEnd();

					e.preventDefault();
				}
			} else if (e.keyCode === 40) { // down
				if (currentHistoryId === null) {
					// no effect
				} else if (currentHistoryId < history.length - 1) {
					currentHistoryId++;

					element.val(history[currentHistoryId]);

					setCursorPosToEnd();

					e.preventDefault();
				} else {
					currentHistoryId = null;

					element.val('');

					e.preventDefault();
				}
			}
		});

		element.bind('input', function(e) {
			// when editing a line from history, treat it as a new entry

			currentHistoryId = null;
		});

		$rootScope.$watch('state.activeEntityId', function(newActiveEntityId) {
			if (entity.entityId === newActiveEntityId) {
				// if our entity is becoming active, focus the chatbox

				$timeout(function() {
					element[0].focus();
				});
			}
		});
	};
});

webircApp.directive('chatboxAutocomplete', function($rootScope) {
	return function(scope, element) {
		var rawElement = element[0];

		var autoComplete = initAutoComplete();

		element.bind('keydown', function(e) {
			if (e.keyCode === 9) { // tab
				var activeEntity = sc.utils.getEntityById($rootScope.state, $rootScope.state.activeEntityId);

				var autoCompleteResult = autoComplete.next(element.val(), rawElement.selectionStart, activeEntity);

				if (autoCompleteResult) {
					element.val(autoCompleteResult.chatboxValue);

					rawElement.selectionStart = rawElement.selectionEnd = autoCompleteResult.cursorPos;
				}

				e.preventDefault();
			} else {
				// any other keypress resets the autocomplete
				autoComplete.reset();
			}
		});
	};
});

webircApp.directive('chatboxAutogrow', function($rootScope, $timeout) {
	return function(scope, element) {
		var shadow = angular.element('<div/>').addClass('chatboxshadow');

		// append the shadow to the chatbox's parent (chatboxwrapper)
		element.parent().append(shadow);

		var chatBox = $(element);

		var checkHeight = function() {
			// manually control scrolling as it causes visual glitches
			chatBox.css('overflow-y', 'hidden');

			shadow.css('width', chatBox.width() + 'px');

			var previousHeight = chatBox.height();

			var newContentHtml = chatBox.val().replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/&/g, '&amp;')
				.replace(/\n$/, '<br/>.')
				.replace(/\n/g, '<br/>')
				.replace(/ {2,}/g, function(space) { return (new Array(space.length).join('&nbsp;')) + ' '; })
				.replace(/^$/g, '.');

			shadow.html(newContentHtml);

			var targetHeight = $(shadow).height();
			var minHeight = stripPx(chatBox.css('line-height'));
			if (targetHeight > 150) {
				targetHeight = 150;

				// now scrolling will be needed
				chatBox.css('overflow-y', 'auto');
			} else if (targetHeight < minHeight) {
				targetHeight = minHeight;
			}

			if (targetHeight != previousHeight) {
				chatBox.css('height', targetHeight);

				scope.chatboxHeight = targetHeight;

				$rootScope.$apply();
			}
		};
		element.bind('input paste keypress keydown change', checkHeight);

		// call it initially to set the initial height
		$timeout(function() {
			checkHeight();
		});
	};
});

function AppCtrl($rootScope, socketFactory) {
	initializeSocketConnection($rootScope, socketFactory);
}

function getTargetHeightForMaincell(chatboxHeight) {
	var chatboxWrapper = $('.chatboxwrapper');

	if (typeof chatboxHeight !== 'number') {
		return null;
	}

	return ($(window).height()
		- stripPx(chatboxWrapper.css('padding-top'))
		- chatboxHeight
		- stripPx(chatboxWrapper.css('padding-bottom'))
	);
}

function stripPx(text) {
	return parseInt(text.replace('px', ''), 10);
}

function arrayRemoveDuplicates(arr) {
	var seen = {};

	return arr.filter(function(el) {
		return seen[el] ? false : (seen[el] = true);
	});
}
