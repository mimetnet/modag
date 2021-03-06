/*!
 * modag.js :: (c) Dan Jarvis 2013 :: License MIT
 */
!function (name, context, definition) {
  if ('undefined' !== typeof module && module.exports) module.exports = definition()
  else if ('function' === typeof define && define.amd) define(definition)
  else context[name] = definition()
}('modag', this, function () {

  var _overlayDefaults = {
      'z-index': 1
    , 'display': 'none'
    , 'height': '100%'
    , 'width': '100%'
    , 'margin': 0
    , 'padding': 0
    , 'position': 'absolute'
    , 'top': '0px'
    , 'left': '0px'
    , 'opacity': '0.8'
    , 'background': '#000'
    }
    , _animationDefaults = {
        overlayIn: {
          css: { 'display': 'block', 'opacity': '0' }
        , animate: { 'duration': 100, 'opacity': '0.8' }
        }
      , overlayOut: {
          css: {}
        , animate: { 'opacity': '0', 'duration': 250 }
        }
      , dialogIn: {
          css: { 'display': 'block', 'margin-top': '-1000px' }
        , animate: { 'margin-top': '-200px', 'duration': 300 }
        }
      , dialogOut: {
          css: {}
        , animate: { 'margin-top': '-1000px', 'duration': 300 }
        }
      }
    , _xhr = window['XMLHttpRequest'] ?
      function () {
        return new XMLHttpRequest();
      } :
      function () {
        return new ActiveXObject('Microsoft.XMLHTTP');
      };

  function _async(fn) {
    setTimeout(fn, 20);
  }

  function _extend(target, source) {
    var prop;
    target = target || {};
    for (prop in source) {
      if ('object' === typeof source[prop].constructor)
        target[prop] = this._extend(target[prop], source[prop]);
      else
        target[prop] = source[prop];
    }
    return target;
  }

  function _clone(o) {
    var i, c = {};
    for (i in o)
      if ('object' === typeof o[i])
        c[i] = _clone(o[i]);
      else
        c[i] = o[i];
    return c;
  }

  function _addClasses(classes, selector) {
    if ('undefined' === typeof classes)
      return;

    if ('string' === typeof classes)
      $(selector).toggleClass(classes);
    else if (Array === classes.constructor)
      for (var klass in classes)
        $(selector).toggleClass(classes[klass]);
  }

  function _addAttributes(attributes, selector) {
    if ('undefined' !== typeof attributes)
      for (var k in attributes)
        $(selector).attr(k, attributes[k]);
  }

  function _addEvents(events, selector, mo) {
    if ('undefined' !== typeof events) {
      for (var evt in events)
        $(selector).on(evt, events[evt], mo);
    }
  }

  /**
   * Create the overlay (mask) for a dialog.
   */
  function _createOverlay(mo) {
    var e, html, o = mo.overlay.selector;

    if ('undefined' !== typeof mo._overlayElement)
      return mo._overlayElement;

    // Assume a class selector for overlay
    if ('undefined' === typeof o)
      o = '.overlay';
    else if (o[0] != '#' && o[0] != '.')
      o = '.' + o;

    e = $(o)[0];
    if ('undefined' !== typeof e)
      return e;

    html = '<div ';
    if (o[0] == '#')
      html += 'id="' + o.substring(1) + '"';
    else
      html += 'class="' + o.substring(1) + '"';
    html += '></div>';
    $('body').append(html);

    mo.overlay.selector = o;

    // Add additional CSS if specified...
    if ('object' === typeof mo.overlay.css) {
      mo.overlay.css = _extend(_overlayDefaults, mo.overlay.css);
      $(o).css(mo.overlay.css);
    }
    return $(o)[0];
  }

  /**
   * Check if the _dialogElement exists
   */
  function _checkDialog(mo) {
    if ('undefined' !== typeof mo._dialogElement)
      return mo._dialogElement;
    return $(mo.selector)[0];
  }

  /**
   * Retreive a dialog from a URL
   */
  function _fetchDialog(url, onSuccess, onError) {
    if ('undefined' === typeof url || url.length === 0)
      return;

    var onReadyStateChange = function () {
      if (this.readyState === 4) {
        // Thanks to http://github.com/ded/reqwest / @ded
        if (/^20\d$/.test(this.status)) {
          $('body').append(this.responseText);
          if ('function' === typeof onSuccess)
            onSuccess($('body').children().last());
        } else {
          if ('function' === typeof onError) {
            onError(this);
          }
        }
      }
    };

    var req = _xhr();
    req.onreadystatechange = onReadyStateChange;
    req.open('GET', url, true);
    req.send('');
  }

  /**
   * Modag Implementation
   */

  function Modag(opts) {
    var mo = _extend(this, opts || {});
    mo.animations = _extend(mo.animations, _animationDefaults);
    if (mo.preload && 'undefined' !== typeof mo.url)
      mo._preload();

    if (mo.trigger.selector && mo.trigger.event) {
      $(mo.trigger.selector).on(mo.trigger.event, function (e, dialog) {
        dialog.show();
      }, mo);
    }
  }

  Modag.prototype = {
    selector: undefined,
    classes: [],
    attributes: {},
    preload: true,
    animate: false,
    animations: { overlayIn: {}, overlayOut: {}, dialogIn: {}, dialogOut: {} },
    modal: true,
    hideOnOverlayClick: true,
    overlay: {},
    url: undefined,
    shown: undefined,
    hidden: undefined,
    trigger: {},
    content: {},
    _loaded: false,
    _overlayElement: undefined,
    _dialogElement: undefined,

    /**
     * Show the dialog.
     */
    show: function () {
      var mo = this;
      mo._dialogElement = _checkDialog(mo);

      // Obtain a DOM Element for the dialog
      if ('undefined' === typeof mo._dialogElement) {
        _fetchDialog(mo.url, function (e) {
            mo._dialogElement = e;
            mo._fill();
          },
          function (err) {
            if (window.console)
              console.log(err);
          }
        );
      } else {
        if (!mo._loaded)
          mo._fill(true);
        else
          mo._show();
      }
    },

    /**
     * Hide the dialog.
     */
    hide: function () {
      this._hide();
    },

    /**
     * Update dialog content.
     *
     * Expected argument combinations:
     * @param {String} args[0] Content key (selector) for the modag instance
     * @param {Object} args[1] Object value for content[key].
     *                         Note: this parameter can also be a string or number.
     *                         In which case it will be set as content[key]['text']
     *      -- OR --
     *
     * @param {Object} args[0] An object of key / value pairs, where the key
     *                         represents the selector and the value is either
     *                         an object or a string / number:
     *                         { '.message' : { html: '<em>My message</em>', // etc... } }
     *                         { '.message': 'My message' }
     */
    set: function () {
      var key, keys = [], args = [].slice.call(arguments)
        , _val = function (arg) {
          return 'object' === typeof arg ? arg : { text: arg };
        };

      if (args.length == 1 && 'object' === typeof args[0]) {
        for (key in args) {
          if ('undefined' === typeof this.content[key])
            this.content[key] = _val(args[key]);
          else
            this.content[key] = _extend(this.content[key], _val(args[key]));
          keys.push(key);
        }
        this._setContent(keys);
      } else if (arguments.length == 2) {
        key = args[0];
        if ('undefined' === typeof this.content[key])
          this.content[key] = _val(args[1]);
        else
          this.content[key] = _extend(this.content[key], _val(args[1]));
        this._setContent(key);
      }
    },

    /**
     * Destroy the dialog.
     *
     * Remove trigger events and any events added to content items.
     * Remove _dialogElement from the DOM.
     */
    destroy: function () {
      var c, evt;

      if (this.trigger.selector && this.trigger.event)
        $(this.trigger.selector).off(this.trigger.event);

      if ('object' === typeof this.content) {
        for (c in this.content) {
          if ('object' === typeof c.events)
            for (evt in c.events)
              $(c.selector, this._dialogElement).off(evt);
        }
      }

      if (this.modal) {
        this._hideOverlay(this, function () {
          $(this._overlayElement).off('click');
        });
      }
      $(this._dialogElement).remove();
    },

    /**
     * Manipulate the DOM for one or more content items
     *
     * @private
     *
     * Expected arguments combinations:
     * @param {String} key content item key (selector) to set
     *
     *      -- OR --
     *
     * @param {Array} keys content item keys (selectors) to set
     */
    _setContent: function () {
      var key, item, selector
        , keys = []
        , args = [].slice.call(arguments);

      if (args.length > 0) {
        if (Array !== args[0].constructor)
          keys.push(args[0]);
        else
          keys = args[0];

        for (key in keys) {
          item = this.content[keys[key]];
          selector = $(keys[key], this._dialogElement);

          if (item.text)
            $(selector).text(item.text);
          if (item.html)
            $(selector).html(item.html);

          _addClasses(item.classes, selector);
          _addAttributes(item.attributes, selector);
          _addEvents(item.events, selector, this);
        }
      }
    },

    /**
     * Preload dialog markup from a URL.
     *
     * @private
     */
    _preload: function () {
      var mo = this;
      _async(function () {
        mo._dialogElement = _checkDialog(mo);
        if ('undefined' === typeof mo._dialogElement) {
          _fetchDialog(mo.url,
              function (e) {
                mo._loaded = true;
                mo._dialogElement = e;
                mo._fill();
              },
              function (err) {
                if (window.console)
                  console.log(err);
              }
            );
        }
      });
    },

    /**
     * Fill a dialog with content.
     *
     * @private
     */
    _fill: function (show) {
      var c;

      // Add additional root classes if specified
      _addClasses(this.classes, this._dialogElement);

      // Content
      if ('object' === typeof this.content)
        for (c in this.content)
          this._setContent(c);

      if (show)
        this._show();
    },

    _show: function () {
      var mo = this;
      if (this.modal) {
        this._showOverlay(function () {
          mo._showDialog(function () {
            if ('function' === typeof mo.shown) {
              mo.shown(mo);
            }
          });
        });
      } else {
        this._showDialog(function () {
          if ('function' === typeof mo.shown)
            mo.shown(mo);
        });
      }
    },

    _hide: function () {
      var mo = this;
      if (this.modal) {
        this._hideDialog(function () {
          mo._hideOverlay(function () {
            if ('function' === typeof mo.hidden)
              mo.hidden(mo);
          });
        });
      } else {
        this._hideDialog(function () {
          if ('function' === typeof mo.hidden)
            mo.hidden(mo);
        });
      }
    },

    _showOverlay: function (onComplete) {
      var css
        , ani
        , mo = this;

      if ('undefined' === typeof this._overlayElement)
        this._overlayElement = _createOverlay(this);

      if (this.hideOnOverlayClick) {
        $(this._overlayElement).on('click', function () {
          mo.hide();
        });
      }

      if (this.animate) {
        css = _clone(this.animations.overlayIn.css);
        ani = _clone(this.animations.overlayIn.animate);
        ani['complete'] = onComplete;
        $(this._overlayElement).css(css).animate(ani);
      } else {
        $(this._overlayElement).show('block');
        if ('function' === typeof onComplete)
          onComplete();
      }
    },

    _hideOverlay: function (onComplete) {
      var mo = this
        , css
        , ani
        , complete = function () {
          $(mo._overlayElement).hide();
          if ('function' === typeof onComplete)
            onComplete();
        };
      if (this.hideOnOverlayClick)
        $(this._overlayElement).on('click', null);

      if (this.animate) {
        css = _clone(this.animations.overlayOut.css);
        ani = _clone(this.animations.overlayOut.animate);
        ani['complete'] = complete;
        $(this._overlayElement).css(css).animate(ani);
      } else {
        $(this._overlayElement).hide();
        if ('function' === typeof onComplete)
          onComplete();
      }
    },

    _showDialog: function (onComplete) {
      var ani
        , css;

      if (this.animate) {
        css = _clone(this.animations.dialogIn.css);
        ani = _clone(this.animations.dialogIn.animate);
        ani['complete'] = onComplete;
        $(this._dialogElement).css(css).animate(ani);
      } else {
        $(this._dialogElement).show('block');
        if ('function' === typeof onComplete)
          onComplete();
      }
    },

    _hideDialog: function (onComplete) {
      var mo = this
        , css
        , ani
        , complete = function () {
            $(mo._dialogElement).hide();
            if ('function' === typeof onComplete)
              onComplete();
          };

      if (this.animate) {
        css = _clone(this.animations.dialogOut.css);
        ani = _clone(this.animations.dialogOut.animate);
        ani['complete'] = complete;
        $(this._dialogElement).css(css).animate(ani);
      } else {
        $(this._dialogElement).hide();
        if ('function' === typeof onComplete)
          onComplete();
      }
    }
  };

  function modag(opts) {
    return new Modag(opts);
  }

  return modag;
});

