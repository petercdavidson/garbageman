// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'Restart';
squiffy.story.id = '045d7d67bb';
squiffy.story.sections = {
	'': {
		'clear': true,
		'text': "",
		'passages': {
		},
	},
	'Restart': {
		'text': "<p>Garbage Man</p>\n<p>by <a href=\"https://petercdavidson.com\">Peter C. Davidson</a>.</p>\n<p>Ported from the <a href=\"http://www.ticalc.org/archives/files/fileinfo/470/47006.html\">2009 original</a> for the TI-83 and 84 Plus.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Play\" role=\"link\" tabindex=\"0\">Play</a></p>",
		'attributes': ["flash=0","gun=0"],
		'passages': {
		},
	},
	'Play': {
		'text': "<p>You are a garbage man. You empty the garbage. It&#39;s a lot of fun.</p>\n<p>One day you find three garbage cans. The first can is on fire. The second one is smoking. The third one looks fine.</p>\n<p>Which one do you empty?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Fire\" role=\"link\" tabindex=\"0\">Fire</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Smoking\" role=\"link\" tabindex=\"0\">Smoking</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Normal\" role=\"link\" tabindex=\"0\">Normal</a></p>",
		'passages': {
		},
	},
	'Fire': {
		'text': "<p>You attempt to empty the garbage can, but you get fourth-degree burns and die.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'Smoking': {
		'text': "<p>You open the lid and discover that the can is filled with acid!</p>\n<p>Your face gets burned off and you become Two-Face. You roam Gotham doing evil until Batman throws you off a roof.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'Normal': {
		'text': "<p>Yippee. Now the garbage can is empty.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Hobo\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Hobo': {
		'text': "<p>You walk out into the street, and you see a creepy-looking hobo guy running towards you and yelling. What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Ignore him\" role=\"link\" tabindex=\"0\">Ignore him</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Talk to him\" role=\"link\" tabindex=\"0\">Talk to him</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Shoot him\" role=\"link\" tabindex=\"0\">Shoot him</a></p>",
		'passages': {
		},
	},
	'Shoot him': {
		'text': "<p>Uh, you don&#39;t have a gun.</p>\n<p>Yet.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Hobo\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'Ignore him': {
		'text': "<p>You manage to avoid the crazy hobo by ducking into an alley filled with dumpsters. The hobo wanders on past. Phew.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Alley\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Talk to him': {
		'text': "<p>The hobo guy walks up to you and says, &quot;Come here, boy. I&#39;ve got a story for you. Listen closely...&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>The hobo leans in close to your ear. His breath smells like fish sticks.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>&quot;Five hundred years ago, my great-uncle Pork came to this land. He came in search of a treasure... a great treasure.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<p>&quot;The legend of the treasure has been passed down through the ages until I heard   about it. But I&#39;m getting old.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'text': "<p>&quot;I can&#39;t search for the treasure anymore. But I&#39;m the last living holder of the secret of the treasure. So I&#39;m passing it on.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<p>&quot;What do you say, boy? Will you take up the legacy of searching for great-uncle Pork&#39;s treasure?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Yes help hobo\" role=\"link\" tabindex=\"0\">Sure!</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Yes help hobo\" role=\"link\" tabindex=\"0\">Why Not?</a></p>",
		'passages': {
		},
	},
	'Yes help hobo': {
		'text': "<p>He slaps you on the back. &quot;Thanks, boy! I knew I could count on you. Here, take this stuff:&quot;</p>\n<p>The hobo gives you an old and tattered MAP, and A HUNDRED DOLLARS. Whoa.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>He grins. &quot;I&#39;ve been savin&#39; that money for fifty years!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue7': {
		'text': "<p>With that, the hobo runs off and hides inside a hot dog stand.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>You pocket the hundred dollars and take a look at the map. It doesn&#39;t look like much.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'text': "<p>It has a picture of a flower on  it, and the words &quot;2 then 1&quot; written in blue ink. You fold it and put it in your pocket.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue10': {
		'text': "<p>You continue to walk down the street until you see a gun shop. It looks pretty cool.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gunshop\" role=\"link\" tabindex=\"0\">Go in</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"alleywalk\" role=\"link\" tabindex=\"0\">Keep walking</a></p>",
		'passages': {
		},
	},
	'Gunshop': {
		'text': "<p>You step into the store. &quot;Greetings and  welcome, kind customer!&quot; The man behind the counter says.</p>\n<p>&quot;We have many fine product! Please for to look around!&quot; The walls are covered with guns.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>Do you want to ask him about anything? There are all kinds of cool guns here.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gunselect\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Gunselect': {
		'text': "<p>Gun Shop:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Notforsale\" role=\"link\" tabindex=\"0\">Shotgun</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Notforsale\" role=\"link\" tabindex=\"0\">AK-47</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Askpistol\" role=\"link\" tabindex=\"0\">Pistol</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Notforsale\" role=\"link\" tabindex=\"0\">Sniper</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Notforsale\" role=\"link\" tabindex=\"0\">Tommy Gun</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Notforsale\" role=\"link\" tabindex=\"0\">Bazooka</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Leaveshop\" role=\"link\" tabindex=\"0\">Leave store</a></p>",
		'passages': {
		},
	},
	'Notforsale': {
		'text': "<p>The storekeeper shakes his head sadly. &quot;So sorry! Not for sale!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gunselect\" role=\"link\" tabindex=\"0\">Keep looking</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Leaveshop\" role=\"link\" tabindex=\"0\">Leave store</a></p>",
		'passages': {
		},
	},
	'Askpistol': {
		'text': "<p>&quot;Ah, yes. The pistol!&quot; He says. &quot;Excellent choice! Only ONE HUNDRED DOLLARS! Wonderful bargain!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>What a coincidence! That&#39;s just how much money the hobo guy gave you. What do you want to do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Buypistol\" role=\"link\" tabindex=\"0\">Buy it</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gunselect\" role=\"link\" tabindex=\"0\">Keep looking</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Leaveshop\" role=\"link\" tabindex=\"0\">Leave store</a></p>",
		'passages': {
		},
	},
	'Buypistol': {
		'text': "<p>You hand him the money, and he gives you the gun, a holster, and 7 bullets. You now have a PISTOL.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'attributes': ["gun = 22.44"],
		'passages': {
		},
	},
	'_continue13': {
		'text': "<p>Well, you&#39;re all out of money, so there&#39;s no use staying here anymore.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Leaveshop\" role=\"link\" tabindex=\"0\">Leave store</a></p>",
		'passages': {
		},
	},
	'Leaveshop': {
		'text': "<p>You turn around and walk out of the store.</p>\n<p>&quot;Please come again!&quot; the storekeeper yells after you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"alleywalk\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'alleywalk': {
		'text': "<p>You walk on down the street. Then, you notice a dark alley full of dumpsters. Oh boy! More garbage!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue14': {
		'text': "<p>You walk into the alley. It&#39;s kinda creepy, but hey, if you don&#39;t empty the garbage, who will?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Alley\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'Alley': {
		'text': "<p>Suddenly, a guy who looks like he&#39;s in the Mafia jumps out from behind a dumpster and holds a gun to your head.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>&quot;Do you know anything about the French Mafia?&quot; he demands.</p>\n<p>Well, you&#39;d better answer him!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Alleyes\" role=\"link\" tabindex=\"0\">Yes</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Alleyno\" role=\"link\" tabindex=\"0\">No</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Alleymaybe\" role=\"link\" tabindex=\"0\">Maybe</a></p>",
		'passages': {
		},
	},
	'Alleyes': {
		'text': "<p>&quot;Okay then.&quot; he says. &quot;Nothin&#39;  personal, but I&#39;m gonna have  to kill ya.&quot;</p>\n<p>And he does. Dang.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'Alleyno': {
		'text': "<p>He scowls. &quot;You liar! I can see right through ya. You know too much. Now I&#39;m gonna have to kill ya.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>Well, that stinks. But that&#39;s what you get for being a liar.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'Alleymaybe': {
		'text': "<p>&quot;Aw, a wise guy, huh?&quot; He laughs visciously. &quot;Take him out, boys. We&#39;ll take &#39;im back to the boss.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<p>Something hits you on the back of the head, and you black out.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue18': {
		'text': "<p>. . . </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue19': {
		'text': "<p>You wake up in a dark, windowless room full of crates and metal cases. The floor is made of wood planks and looks very old.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'text': "<p>A single light bulb hangs from the ceiling. There appears to be no way out of the room.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"TheRoom\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'TheRoom': {
		'text': "<p>What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"roomwaste\" role=\"link\" tabindex=\"0\">Wait</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"lookroom\" role=\"link\" tabindex=\"0\">Look around</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"roomwaste\" role=\"link\" tabindex=\"0\">Do a dance</a></p>",
		'passages': {
		},
	},
	'roomwaste': {
		'text': "<p>Uh, okay. That  was fun.</p>\n<p>Nothing happened though.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"TheRoom\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'lookroom': {
		'text': "<p>Where do you want to look?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"lookcrates\" role=\"link\" tabindex=\"0\">Crates</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"lookcases\" role=\"link\" tabindex=\"0\">Metal cases</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"lookfloor\" role=\"link\" tabindex=\"0\">Floor</a></p>",
		'passages': {
		},
	},
	'lookfloor': {
		'text': "<p>Um, it&#39;s a floor. </p>\n<p>It&#39;s a nice floor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"TheRoom\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'lookcases': {
		'text': "<p>{if flash=22.44:Geez, how many flashlights do you need? Look somewhere else.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"TheRoom\" role=\"link\" tabindex=\"0\">Back</a></p>\n<p>}\n{else:You go and open the nearest case and reach inside. You pull out a brand-new FLASHLIGHT!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"pocketflash\" role=\"link\" tabindex=\"0\">Continue</a></p>\n<p>}</p>",
		'passages': {
		},
	},
	'pocketflash': {
		'text': "<p>You pocket the FLASHLIGHT. This could come in handy later.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"TheRoom\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'attributes': ["flash = 22.44"],
		'passages': {
		},
	},
	'lookcrates': {
		'text': "<p>You walk over to the nearest crate and pry open the lid. You hear a faint whirring sound coming from inside the crate.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<p>A smooth steel control panel rises out of the crate.</p>\n<p>There are three buttons on the panel. Which button do you push?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cratedie\" role=\"link\" tabindex=\"0\">1st button</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cratetwo\" role=\"link\" tabindex=\"0\">2nd button</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cratedie\" role=\"link\" tabindex=\"0\">3rd button</a></p>",
		'passages': {
		},
	},
	'cratedie': {
		'text': "<p>The button begins flashing red, and an alarm sounds. </p>\n<p>The crate explodes, and you are killed instantly.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'cratetwo': {
		'text': "<p>The button flashes green, and stays lit.</p>\n<p>Which button do you push now?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cratethree\" role=\"link\" tabindex=\"0\">1st button</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cratedie\" role=\"link\" tabindex=\"0\">2nd button</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"cratedie\" role=\"link\" tabindex=\"0\">3rd button</a></p>",
		'passages': {
		},
	},
	'cratethree': {
		'text': "<p>The button flashes green, and you hear a creaking sound. A trapdoor opens beneath you and you fall into the darkness.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"afterfall\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'afterfall': {
		'text': "<p>You land hard on a rough wooden surface.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgedark\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'bridgedark': {
		'text': "<p>You can&#39;t see a thing, but you hear running water. What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"toodark\" role=\"link\" tabindex=\"0\">Look around</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"trybridgelight\" role=\"link\" tabindex=\"0\">Use flashlight</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgewalk\" role=\"link\" tabindex=\"0\">Walk around</a></p>",
		'passages': {
		},
	},
	'toodark': {
		'text': "<p>Um, it&#39;s really dark.</p>\n<p>You can&#39;t see nuttin&#39;.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgedark\" role=\"link\" tabindex=\"0\">Back</a></p>",
		'passages': {
		},
	},
	'bridgewalk': {
		'text': "<p>You take a few steps, and then you fall several feet into cold  water and get eaten by an alligator.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'trybridgelight': {
		'text': "<p>{if flash=22.44:You turn on the flashlight. You see that you are underground. You are standing on a bridge that is surrounded by water.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridge\" role=\"link\" tabindex=\"0\">Continue</a></p>\n<p>}\n{else:So sorry!</p>\n<p>You has no flashlight!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgedark\" role=\"link\" tabindex=\"0\">Back</a></p>\n<p>}</p>",
		'passages': {
		},
	},
	'bridge': {
		'text': "<p>The beam of light only illuminates a few feet ahead of you. The bridge stretches as far as you can see in both directions.</p>\n<p>What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgeforward\" role=\"link\" tabindex=\"0\">Walk forward</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgebackward\" role=\"link\" tabindex=\"0\">Walk backward</a></p>",
		'passages': {
		},
	},
	'bridgebackward': {
		'text': "<p>You turn around and start walking. After about 5 minutes, you come to a wall.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgewall\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'bridgewall': {
		'text': "<p>There are two buttons on the wall.</p>\n<p>The first button is labeled &quot;no&quot;, and the second  button is labeled &quot;yes&quot;. Very mysterious.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"pushno\" role=\"link\" tabindex=\"0\">Push &quot;no&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"pushyes\" role=\"link\" tabindex=\"0\">Push &quot;yes&quot;</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgeback\" role=\"link\" tabindex=\"0\">Go back</a></p>",
		'passages': {
		},
	},
	'bridgeback': {
		'text': "<p>You turn around and walk back to where you started.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridge\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'pushno': {
		'text': "<p>You push the button labeled &quot;no&quot;. A funny computer voice  says, &quot;NO!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"bridgewall\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'pushyes': {
		'text': "<p>You push the button. You hear a strange humming sound. A floating, semi-transparent face appears in front of you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue22': {
		'text': "<p>&quot;Welcome to the Opticon,&quot; the face says in a dreamy voice. &quot;Choose your destiny.&quot;</p>\n<p>What is your destiny?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">snout</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">plastic</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">pinstripe</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">tableau</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">frisbee</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">debate</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"opticon\" role=\"link\" tabindex=\"0\">chrome</a></p>",
		'passages': {
		},
	},
	'opticon': {
		'text': "<p>The face frowns kindly.</p>\n<p>&quot;I am sorry. You have chosen poorly. Your destiny is now death.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue23': {
		'text': "<p>And then you die. Sorry.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'bridgeforward': {
		'text': "<p>You start walking forward.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue24': {
		'text': "<p>After about 2 minutes, you see a tiger asleep on the bridge in front of you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"choosetiger\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'choosetiger': {
		'text': "<p>What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"kicktiger\" role=\"link\" tabindex=\"0\">Kick the tiger</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"farshoottiger\" role=\"link\" tabindex=\"0\">Shoot it</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"feedtiger\" role=\"link\" tabindex=\"0\">Feed it</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"backtiger\" role=\"link\" tabindex=\"0\">Go back</a></p>",
		'passages': {
		},
	},
	'backtiger': {
		'text': "<p>You turn around to walk back but the tiger wakes up.</p>\n<p>You try to outrun it, but tigers are really fast.</p>\n<p>He eats you.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'kicktiger': {
		'text': "<p>You walk up to the tiger and kick it really hard.</p>\n<p>The tiger wakes up, and for some reason, he&#39;s really mad.</p>\n<p>He eats you.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'farshoottiger': {
		'text': "<p>{if gun=22.44:You pull out your pistol and fire at the tiger.</p>\n<p>Unfortunately, your aim stinks. You miss, and the tiger wakes up and eats you.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>\n<p>}\n{else:Uh, you don&#39;t have a gun.</p>\n<p>Yet.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"choosetiger\" role=\"link\" tabindex=\"0\">Back</a></p>\n<p>}</p>",
		'passages': {
		},
	},
	'feedtiger': {
		'text': "<p>You look around for something to feed the tiger.</p>\n<p>While you are looking, the tiger wakes up and runs towards you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"tigerrun\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'tigerrun': {
		'text': "<p>He&#39;s really close now! What do you do?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"closeshoottiger\" role=\"link\" tabindex=\"0\">Shoot him</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hugtiger\" role=\"link\" tabindex=\"0\">Give him a hug</a></p>",
		'passages': {
		},
	},
	'hugtiger': {
		'text': "<p>You stretch out your arms and give the tiger a big hug. He hugs you too.</p>\n<p>With his claws.</p>\n<p>What a meanie.</p>\n<p>GAME OVER</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
	'closeshoottiger': {
		'text': "<p>{if gun=22.44:You draw your pistol and shoot the tiger at point-blank range.</p>\n<p>He yelps and falls off the bridge into the water.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"homestretch\" role=\"link\" tabindex=\"0\">Continue</a></p>\n<p>}\n{else:You still don&#39;t have a gun, bub.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"tigerrun\" role=\"link\" tabindex=\"0\">Back</a></p>\n<p>}</p>",
		'passages': {
		},
	},
	'homestretch': {
		'text': "<p>You continue to walk along the bridge until you come to a large metal door. You touch the door and it retracts into the floor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue25': {
		'text': "<p>You step into a large space that looks like a conference room. There is a large table, and ten people  sit around it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue26\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue26': {
		'text': "<p>The men all wear uniforms, and look very official. The man at the end of the table stands up and starts clapping.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue27\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue27': {
		'text': "<p>&quot;Well done!&quot; he says with a grin. &quot;You have passed our test. We offer our congratulations.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue28\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue28': {
		'text': "<p>&quot;We are the League of Extraordinary Garbagemen. You have proved worthy to join our ranks, if you so choose.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue29\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue29': {
		'text': "<p>He extends his hand and smiles. &quot;What do you say? Will you join the LXG and fight for the cause?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue30\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue30': {
		'text': "<hr>\n<h2 id=\"find-out-in-garbage-man-2-the-league-of-extraordinary-garbagemen-\">Find out in Garbage Man 2: The League of Extraordinary Garbagemen!</h2>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue31\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'_continue31': {
		'text': "<p>You win! Great job!</p>\n<p>Write down this code and use it to access Garbage Man 2.</p>\n<p>Your code:\n82619577</p>\n<p>Click &quot;Restart&quot; to return to the main menu when you&#39;re ready.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Restart\" role=\"link\" tabindex=\"0\">Restart</a></p>",
		'passages': {
		},
	},
}
})();