"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var defaultOptions = {
  templateAttributeName: "cm-template",
  payloadAttributeName: "cm-payload"
};
var contextMenuRequest = "ContextMenu-Request";
var contextMenuResponse = "ContextMenu-Response";
var contextMenuClicked = "ContextMenu-Clicked";

var ContextMenu = function () {
  function ContextMenu(options) {
    _classCallCheck(this, ContextMenu);

    this.options = defaultOptions;
    this.selectedElement = null;
    this.selectedElementAttributes = {};
    this.contextMenuParams = {};
    this.internalFnMap = {};
    this.templatesCleaned = {};

    if (typeof options !== "undefined") {
      this.options = Object.assign(this.options, options);
    }
  }

  _createClass(ContextMenu, [{
    key: "preloadBindings",
    value: function preloadBindings(ipcRenderer) {
      var _this = this;

      var createIpcBindings = function createIpcBindings() {
        ipcRenderer.on(contextMenuRequest, function (event, args) {
          var templateToSend = null;
          _this.selectedElement = null;
          _this.selectedElementAttributes = {};
          _this.contextMenuParams = args.params;
          _this.selectedElement = document.elementFromPoint(args.params.x, args.params.y);

          if (_this.selectedElement !== null) {
            var contextMenuTemplate = _this.selectedElement.getAttribute(_this.options.templateAttributeName);

            if (contextMenuTemplate !== "" && contextMenuTemplate !== null) {
              var attributes = _this.selectedElement.attributes;

              for (var i = 0; i < attributes.length; i++) {
                if (attributes[i].name.indexOf(_this.options.payloadAttributeName) >= 0) {
                  _this.selectedElementAttributes[attributes[i].name.replace("".concat(_this.options.payloadAttributeName, "-"), "")] = attributes[i].value;
                }
              }

              templateToSend = contextMenuTemplate;
            }
          }

          ipcRenderer.send(contextMenuResponse, {
            params: args.params,
            template: templateToSend
          });
        });
        ipcRenderer.on(contextMenuClicked, function (event, args) {
          if (typeof _this.internalFnMap[args.id] !== "undefined") {
            var payload = {
              params: _this.contextMenuParams,
              payload: _this.selectedElementAttributes
            };

            _this.internalFnMap[args.id](payload);
          }
        });
      };

      createIpcBindings();
      return {
        onReceive: function onReceive(id, func) {
          _this.internalFnMap[id] = func;
        },
        clearRendererBindings: function clearRendererBindings() {
          _this.internalFnMap = {};
          _this.contextMenuParams = {};
          ipcRenderer.removeAllListeners(contextMenuRequest);
          ipcRenderer.removeAllListeners(contextMenuClicked);
          createIpcBindings();
        }
      };
    }
  }, {
    key: "mainBindings",
    value: function mainBindings(ipcMain, browserWindow, Menu, isDevelopment, templates) {
      var _this2 = this;

      browserWindow.webContents.on("context-menu", function (event, params) {
        browserWindow.webContents.send(contextMenuRequest, {
          params: params
        });
      });
      ipcMain.on(contextMenuResponse, function (IpcMainEvent, args) {
        var contextMenu;

        if (args.template === null || typeof _this2.templatesCleaned[args.template] === "undefined") {
          contextMenu = templates[args.template];

          if (isDevelopment) {
            contextMenu.push({
              label: "Inspect element",
              click: function click() {
                browserWindow.inspectElement(args.params.x, args.params.y);
              }
            });
          }

          if (args.template !== null) {
            var _loop = function _loop(i) {
              if (typeof contextMenu[i]["click"] === "undefined") {
                contextMenu[i].click = function (event, window, webContents) {
                  browserWindow.webContents.send(contextMenuClicked, {
                    id: contextMenu[i].id || contextMenu[i].label
                  });
                };
              }
            };

            for (var i = 0; i < contextMenu.length; i++) {
              _loop(i);
            }
          }

          _this2.templatesCleaned[args.template] = true;
        } else {
          contextMenu = templates[args.template];
        }

        Menu.buildFromTemplate(contextMenu).popup(browserWindow);
      });
    }
  }, {
    key: "clearMainBindings",
    value: function clearMainBindings(ipcMain) {
      this.templatesCleaned = {};
      ipcMain.removeAllListeners(contextMenuResponse);
    }
  }]);

  return ContextMenu;
}();

var contextMenu = new ContextMenu();
var _default = contextMenu;
exports["default"] = _default;