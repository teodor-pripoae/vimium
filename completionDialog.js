(function(window, document) {

  var CompletionDialog = function(options) { this.options = options; }

  CompletionDialog.prototype = {
    show: function(initialQueryString) {
      if (!this.isShown) {
        this.isShown=true;
        this.query = initialQueryString === undefined ? [] : initialQueryString.split("");
        if (!this.initialized) {
          initialize.call(this);
          this.initialized = true;
        }
        handlerStack.push({ keydown: this.onKeydown });

        // we need to call render() and renderCompletions() later because the latter is asynchronous, and we
        // need this.container to be initialized before applying the tweening to it.
        if (initialQueryString === undefined)
          render.call(this);
        else
          render.call(this, "", []);
        clearInterval(this._tweenId);
        this.container.style.display = "block";
        this._tweenId = Tween.fade(this.container, 1.0, 150);

        if (initialQueryString !== undefined)
          renderCompletions.call(this);
      }
    },

    hide: function() {
      if (this.isShown) {
        handlerStack.pop();
        this.isShown = false;
        this.currentSelection = -1;
        clearInterval(this._tweenId);
        var completionContainer = this.container;
        var cssHide = function() { completionContainer.style.display = "none"; }
        this._tweenId = Tween.fade(this.container, 0, 150, cssHide);
      }
    },

    getDisplayElement: function() {
      if (!this.container)
        this.container = createDivInside(document.body);
      return this.container;
    },

    getQueryString: function() { return this.query.join(""); }
  }

  var initialize = function() {
    var self = this;

    self.currentSelection = -1;

    self.onKeydown = function(event) {
      var keyChar = getKeyChar(event);
      // change selection with up or Shift-Tab
      if (keyChar==="up" || (event.keyCode == 9 && event.shiftKey)) {
        if (self.currentSelection > -1) {
          self.currentSelection -= 1;
        }
        render.call(self,self.getQueryString(), self.completions);
      }
      // change selection with down or Tab
      else if (keyChar==="down" || (event.keyCode == 9 && !event.shiftKey)) {
        if (self.currentSelection < self.completions.length - 1) {
          self.currentSelection += 1;
        }
        render.call(self,self.getQueryString(), self.completions);
      }
      else if (event.keyCode == keyCodes.enter) {
        if (self.currentSelection == -1)
          self.options.onSelect({url:self.selectedString, type:'rawString'});
        else
          self.options.onSelect(self.completions[self.currentSelection]);
      }
      else if (event.keyCode == keyCodes.backspace || event.keyCode == keyCodes.deleteKey) {
        if (self.query.length > 0) {
          // we assume that the user wants to edit the text of a selection, so the selection's string will
          // replace the original search string
          if (self.selectedString && self.query != self.selectedString)
            self.query = self.selectedString.split("");
          self.query.pop();
          self.currentSelection = -1;
          renderCompletions.call(self);
        }
      }
      else if (keyChar && keyChar!=="left" && keyChar!="right") {
        if (self.selectedString && self.query != self.selectedString)
          self.query = self.selectedString.split("");
        self.query.push(keyChar);
        self.currentSelection = -1;
        renderCompletions.call(self);
      }

      event.stopPropagation();
      event.preventDefault();
      return true;
    }
  }

  var renderCompletions = function() {
    var self = this;
    self.mostRecentQueryId = Math.random();
    self.completions = [];
    self.options.source(self.mostRecentQueryId, self.getQueryString(), function(queryId, completions) {
      if (queryId == self.mostRecentQueryId) {
        Array.prototype.push.apply(self.completions, completions);
        self.completions.sort(function(a, b) { return a.priority - b.priority; });
        render.call(self, self.getQueryString(), self.completions);
      }
    });
  };

  var render = function(searchString, completions) {
    if (this.isShown) {
      this.selectedString = searchString;
      this.completions = completions;
      var container = this.getDisplayElement();
      clearChildren(container);
      container.style.display = "";

      if (searchString === undefined) {
        this.container.className = "vimiumReset vimium-dialog";
        createDivInside(container).innerHTML = this.options.initialSearchText || "Begin typing";
      }
      else {
        this.container.className = "vimiumReset vimium-dialog vimium-completions";
        var searchBar = createDivInside(container);
        searchBar.innerHTML=searchString;
        searchBar.className="vimiumReset vimium-searchBar";

        searchResults = createDivInside(container);
        searchResults.className="vimiumReset vimium-searchResults";
        if (completions.length<=0) {
          var resultDiv = createDivInside(searchResults);
          resultDiv.className="vimiumReset vimium-noResults";
          resultDiv.innerHTML="No results found";
        }
        else {
          for (var i = 0; i < completions.length; i++) {
            var resultDiv = createDivInside(searchResults);
            if (i === this.currentSelection) {
              resultDiv.className="vimiumReset vimium-selected";
              this.selectedString = this.options.selectionToText(completions[i]);
            }
            resultDiv.innerHTML=this.options.renderOption(searchString, completions[i]);
          }
        }

        searchBar.innerHTML = this.selectedString;
      }

      container.style.top =  window.innerHeight/4 + "px";
      container.style.left = (window.innerWidth/2-container.clientWidth/2) + "px";
    }
  };
  var createDivInside = function(parent) {
    var element = document.createElement("div");
    element.className = "vimiumReset";
    parent.appendChild(element);
    return element;
  }

  var clearChildren = function(elem) {
    if (elem.hasChildNodes()) {
      while (elem.childNodes.length >= 1) {
        elem.removeChild(elem.firstChild);
      }
    }
  }

  window.CompletionDialog = CompletionDialog;

}(window, document))
