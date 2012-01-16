function activateOmniModeToOpenInNewTab() {
  OmniMode.openInNewTab(true);
  OmniMode.enable();
}

function activateOmniModeToOpenInNewTabWithCurrentUrl() {
  OmniMode.openInNewTab(true);
  OmniMode.enable(window.location.href);
}

function activateOmniMode() {
  OmniMode.openInNewTab(false);
  OmniMode.enable();
}

function activateOmniModeWithCurrentUrl() {
  OmniMode.openInNewTab(false);
  OmniMode.enable(window.location.href);
}

(function() {
  // so when they let go of shift after hitting capital "B" it won't
  // untoggle it
  var shiftWasPressedWhileToggled = false;

  var OmniMode = {
    isEnabled: function() {
      return this.enabled;
    },
    openInNewTab: function(newTab) {
      this.newTab = newTab;
    },
    invertNewTabSetting: function() {
      this.newTab = !this.newTab;
      if(this.isEnabled()) {
        this.renderHUD();
      }
    },
    enable: function(initialQueryString) {
      this.enabled = true;

      if(!this.initialized) {
        initialize.call(this);
      }

      handlerStack.push({
        keydown: this.onKeydown,
        keypress: this.onKeypress,
        keyup: this.onKeyup
      });

      this.renderHUD();
      this.completionDialog.show(initialQueryString);
    },
    disable: function() {
      this.enabled = false;
      this.completionDialog.hide();
      handlerStack.pop();
      HUD.hide();
    },
    renderHUD: function() {
      if (this.newTab)
        HUD.show("Open a URL in new tab");
      else
        HUD.show("Open a URL in current tab");
    }

  }

  // private method
  var initialize = function() {
    var self = this;
    self.initialized = true;

    self.completionDialog = new CompletionDialog({
      source: findOmniQueryCompletions,

      onSelect: function(selection) {
        if (selection.type === "tab") {
          chrome.extension.sendRequest({handler:"selectTabById", tabId:selection.id});
        }
        else {
          var openInNewTab = self.newTab;
          if (selection.type === "searchCompletion")
            var url = utils.createSearchUrl(selection.text);
          else {
            var url = utils.ensureUrl(selection.url);
            // if it is a bookmarklet, do not open in a new tab
            openInNewTab &= !(url.indexOf("javascript:") === 0);
          }

          if (openInNewTab)
            window.open(url);
          else
            window.location = url;
        }

        self.disable();
      },

      renderOption: function(searchString, selection) {
        if (selection.type === "searchCompletion") {
          var displayText = "<span class='vimiumReset vimium-completionTitle'>[Search] " +
            selection.text + "</span>";
        }
        else {
          var displayTitle = (selection.type === "tab" ? "[Switch] " : "") + selection.title;
          var displayText = "<span class='vimiumReset vimium-completionTitle'>" + displayTitle + "</span>" +
            "<span class='vimiumReset vimium-completionUrl'>" + selection.url + "</span>";
        }
        return displayText.split(new RegExp(searchString, "i")).join("<strong>"+searchString+"</strong>")
      },

      selectionToText: function(selection) {
        if (selection.type === "searchCompletion")
          return selection.text;
        else
          return selection.url;
      },

      initialSearchText: "Type a search string or URL"
    })

    self.onKeydown = function(event) {
      // shift key will toggle between new tab/same tab
      if (event.keyCode == keyCodes.shiftKey) {
        self.invertNewTabSetting();
        shiftWasPressedWhileToggled = true;
        return;
      }

      var keyChar = getKeyChar(event);
      if (!keyChar)
        return;

      // TODO(philc): Ignore keys that have modifiers.
      if (isEscape(event))
        self.disable();
    };

    self.onKeypress = function(event) { return false; }

    self.onKeyup = function(event) {
      // shift key will toggle between new tab/same tab
      if (event.keyCode == keyCodes.shiftKey && shiftWasPressedWhileToggled) {
        self.invertNewTabSetting();
        shiftWasPressedWhileToggled = false;
      }
    };
  }

  var recordPriorities = {
    bookmark: 3,
    history: 3,
    tab: 2,
    searchCompletion: 1,
  };

  var findOmniQueryCompletions = function(queryId, searchString, callback) {
    if (searchString === "") {
      callback(queryId, []);
      return;
    }

    var port = chrome.extension.connect({ name: "getOmniQueryCompletions" });
    var expectedResponses = 3;
    port.onMessage.addListener(function(msg) {
      for (var i in msg.records) {
        msg.records[i].type = msg.recordType;
        // right now we assign every message of one type the same priority -- but we could extend this system
        // in the future to give more useful rankings
        msg.records[i].priority = recordPriorities[msg.recordType];
      }
      callback(msg.queryId, msg.records);
      if (--expectedResponses == 0)
        port = null;
    })
    port.postMessage({query: searchString, queryId: queryId});
    findGoogleSearchCompletions(queryId, searchString, callback);
  };

  var findGoogleSearchCompletions = utils.debounce(function(queryId, searchString, callback) {
    var googleQuery = "http://suggestqueries.google.com/complete/search?client=firefox&q=" + searchString;
    utils.makeAjaxRequest("GET", googleQuery, function(results) {
      var parsedResults = JSON.parse(results);
      var records = parsedResults[1].slice(0,3).map(function(result) {
        return { type: "searchCompletion", text: result, priority: recordPriorities["searchCompletion"] };
      });
      callback(queryId, records);
    });
  }, 200);

  window.OmniMode = OmniMode;
}())
