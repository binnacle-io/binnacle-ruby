/* ===========================================================
# Binnacle JS - v0.2.7
# ==============================================================
# Copyright (c) 2017 Brian Sam-Bodden
# Licensed .
*/
/**
 * Atmosphere.js
 * https://github.com/Atmosphere/atmosphere-javascript
 *
 * API reference
 * https://github.com/Atmosphere/atmosphere/wiki/jQuery.atmosphere.js-API
 *
 * Highly inspired by
 * - Portal by Donghwan Kim http://flowersinthesand.github.io/portal/
 */
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD
        define(factory);
    } else if(typeof exports !== 'undefined') {
        // CommonJS
        module.exports = factory();
    } else {
        // Browser globals, Window
        root.atmosphere = factory();
    }
}(this, function () {

    "use strict";

    var atmosphere = {},
        guid,
        offline = false,
        requests = [],
        callbacks = [],
        uuid = 0,
        hasOwn = Object.prototype.hasOwnProperty;

    atmosphere = {
        version: "2.3.2-javascript",
        onError: function (response) {
        },
        onClose: function (response) {
        },
        onOpen: function (response) {
        },
        onReopen: function (response) {
        },
        onMessage: function (response) {
        },
        onReconnect: function (request, response) {
        },
        onMessagePublished: function (response) {
        },
        onTransportFailure: function (errorMessage, _request) {
        },
        onLocalMessage: function (response) {
        },
        onFailureToReconnect: function (request, response) {
        },
        onClientTimeout: function (request) {
        },
        onOpenAfterResume: function (request) {
        },

        /**
         * Creates an object based on an atmosphere subscription that exposes functions defined by the Websocket interface.
         *
         * @class WebsocketApiAdapter
         * @param {Object} request the request object to build the underlying subscription
         * @constructor
         */
        WebsocketApiAdapter: function (request) {
            var _socket, _adapter;

            /**
             * Overrides the onMessage callback in given request.
             *
             * @method onMessage
             * @param {Object} e the event object
             */
            request.onMessage = function (e) {
                _adapter.onmessage({data: e.responseBody});
            };

            /**
             * Overrides the onMessagePublished callback in given request.
             *
             * @method onMessagePublished
             * @param {Object} e the event object
             */
            request.onMessagePublished = function (e) {
                _adapter.onmessage({data: e.responseBody});
            };

            /**
             * Overrides the onOpen callback in given request to proxy the event to the adapter.
             *
             * @method onOpen
             * @param {Object} e the event object
             */
            request.onOpen = function (e) {
                _adapter.onopen(e);
            };

            _adapter = {
                close: function () {
                    _socket.close();
                },

                send: function (data) {
                    _socket.push(data);
                },

                onmessage: function (e) {
                },

                onopen: function (e) {
                },

                onclose: function (e) {
                },

                onerror: function (e) {

                }
            };
            _socket = new atmosphere.subscribe(request);

            return _adapter;
        },

        AtmosphereRequest: function (options) {

            /**
             * {Object} Request parameters.
             *
             * @private
             */
            var _request = {
                timeout: 300000,
                method: 'GET',
                headers: {},
                contentType: '',
                callback: null,
                url: '',
                data: '',
                suspend: true,
                maxRequest: -1,
                reconnect: true,
                maxStreamingLength: 10000000,
                lastIndex: 0,
                logLevel: 'info',
                requestCount: 0,
                fallbackMethod: 'GET',
                fallbackTransport: 'streaming',
                transport: 'long-polling',
                webSocketImpl: null,
                webSocketBinaryType: null,
                dispatchUrl: null,
                webSocketPathDelimiter: "@@",
                enableXDR: false,
                rewriteURL: false,
                attachHeadersAsQueryString: true,
                executeCallbackBeforeReconnect: false,
                readyState: 0,
                withCredentials: false,
                trackMessageLength: false,
                messageDelimiter: '|',
                connectTimeout: -1,
                reconnectInterval: 0,
                dropHeaders: true,
                uuid: 0,
                async: true,
                shared: false,
                readResponsesHeaders: false,
                maxReconnectOnClose: 5,
                enableProtocol: true,
                disableDisconnect: false,
                pollingInterval: 0,
                heartbeat: {
                    client: null,
                    server: null
                },
                ackInterval: 0,
                closeAsync: false,
                reconnectOnServerError: true,
                handleOnlineOffline: true,
                onError: function (response) {
                },
                onClose: function (response) {
                },
                onOpen: function (response) {
                },
                onMessage: function (response) {
                },
                onReopen: function (request, response) {
                },
                onReconnect: function (request, response) {
                },
                onMessagePublished: function (response) {
                },
                onTransportFailure: function (reason, request) {
                },
                onLocalMessage: function (request) {
                },
                onFailureToReconnect: function (request, response) {
                },
                onClientTimeout: function (request) {
                },
                onOpenAfterResume: function (request) {
                }
            };

            /**
             * {Object} Request's last response.
             *
             * @private
             */
            var _response = {
                status: 200,
                reasonPhrase: "OK",
                responseBody: '',
                messages: [],
                headers: [],
                state: "messageReceived",
                transport: "polling",
                error: null,
                request: null,
                partialMessage: "",
                errorHandled: false,
                closedByClientTimeout: false,
                ffTryingReconnect: false
            };

            /**
             * {websocket} Opened web socket.
             *
             * @private
             */
            var _websocket = null;

            /**
             * {SSE} Opened SSE.
             *
             * @private
             */
            var _sse = null;

            /**
             * {XMLHttpRequest, ActiveXObject} Opened ajax request (in case of http-streaming or long-polling)
             *
             * @private
             */
            var _activeRequest = null;

            /**
             * {Object} Object use for streaming with IE.
             *
             * @private
             */
            var _ieStream = null;

            /**
             * {Object} Object use for jsonp transport.
             *
             * @private
             */
            var _jqxhr = null;

            /**
             * {boolean} If request has been subscribed or not.
             *
             * @private
             */
            var _subscribed = true;

            /**
             * {number} Number of test reconnection.
             *
             * @private
             */
            var _requestCount = 0;

            /**
             * The Heartbeat interval send by the server.
             * @type {int}
             * @private
             */
            var _heartbeatInterval = 0;

            /**
             * The Heartbeat bytes send by the server.
             * @type {string}
             * @private
             */
            var _heartbeatPadding = 'X';

            /**
             * {boolean} If request is currently aborted.
             *
             * @private
             */
            var _abortingConnection = false;

            /**
             * A local "channel' of communication.
             *
             * @private
             */
            var _localSocketF = null;

            /**
             * The storage used.
             *
             * @private
             */
            var _storageService;

            /**
             * Local communication
             *
             * @private
             */
            var _localStorageService = null;

            /**
             * A Unique ID
             *
             * @private
             */
            var guid = atmosphere.util.now();

            /** Trace time */
            var _traceTimer;

            /** Key for connection sharing */
            var _sharingKey;

            /**
             * {boolean} If window beforeUnload event has been called.
             * Flag will be reset after 5000 ms
             *
             * @private
             */
            var _beforeUnloadState = false;

            // Automatic call to subscribe
            _subscribe(options);

            /**
             * Initialize atmosphere request object.
             *
             * @private
             */
            function _init() {
                _subscribed = true;
                _abortingConnection = false;
                _requestCount = 0;

                _websocket = null;
                _sse = null;
                _activeRequest = null;
                _ieStream = null;
            }

            /**
             * Re-initialize atmosphere object.
             *
             * @private
             */
            function _reinit() {
                _clearState();
                _init();
            }

            /**
             * Returns true if the given level is equal or above the configured log level.
             *
             * @private
             */
            function _canLog(level) {
                if (level == 'debug') {
                    return _request.logLevel === 'debug';
                } else if (level == 'info') {
                    return _request.logLevel === 'info' || _request.logLevel === 'debug';
                } else if (level == 'warn') {
                    return _request.logLevel === 'warn' || _request.logLevel === 'info' || _request.logLevel === 'debug';
                } else if (level == 'error') {
                    return _request.logLevel === 'error' || _request.logLevel === 'warn' || _request.logLevel === 'info' || _request.logLevel === 'debug';
                } else {
                    return false;
                }
            }

            function _debug(msg) {
                if (_canLog('debug')) {
                    atmosphere.util.debug(new Date() + " Atmosphere: " + msg);
                }
            }

            /**
             *
             * @private
             */
            function _verifyStreamingLength(ajaxRequest, rq) {
                // Wait to be sure we have the full message before closing.
                if (_response.partialMessage === "" && (rq.transport === 'streaming') && (ajaxRequest.responseText.length > rq.maxStreamingLength)) {
                    return true;
                }
                return false;
            }

            /**
             * Disconnect
             *
             * @private
             */
            function _disconnect() {
                if (_request.enableProtocol && !_request.disableDisconnect && !_request.firstMessage) {
                    var query = "X-Atmosphere-Transport=close&X-Atmosphere-tracking-id=" + _request.uuid;

                    atmosphere.util.each(_request.headers, function (name, value) {
                        var h = atmosphere.util.isFunction(value) ? value.call(this, _request, _request, _response) : value;
                        if (h != null) {
                            query += "&" + encodeURIComponent(name) + "=" + encodeURIComponent(h);
                        }
                    });

                    var url = _request.url.replace(/([?&])_=[^&]*/, query);
                    url = url + (url === _request.url ? (/\?/.test(_request.url) ? "&" : "?") + query : "");

                    var rq = {
                        connected: false
                    };
                    var closeR = new atmosphere.AtmosphereRequest(rq);
                    closeR.connectTimeout = _request.connectTimeout;
                    closeR.attachHeadersAsQueryString = false;
                    closeR.dropHeaders = true;
                    closeR.url = url;
                    closeR.contentType = "text/plain";
                    closeR.transport = 'polling';
                    closeR.method = 'GET';
                    closeR.data = '';
                    closeR.heartbeat = null;
                    if (_request.enableXDR) {
                        closeR.enableXDR = _request.enableXDR
                    }
                    closeR.async = _request.closeAsync;
                    _pushOnClose("", closeR);
                }
            }

            /**
             * Close request.
             *
             * @private
             */
            function _close() {
                _debug("Closing (AtmosphereRequest._close() called)");

                _abortingConnection = true;
                if (_request.reconnectId) {
                    clearTimeout(_request.reconnectId);
                    delete _request.reconnectId;
                }

                if (_request.heartbeatTimer) {
                    clearTimeout(_request.heartbeatTimer);
                }

                _request.reconnect = false;
                _response.request = _request;
                _response.state = 'unsubscribe';
                _response.responseBody = "";
                _response.status = 408;
                _response.partialMessage = "";
                _invokeCallback();
                _disconnect();
                _clearState();
            }

            function _clearState() {
                _response.partialMessage = "";
                if (_request.id) {
                    clearTimeout(_request.id);
                }

                if (_request.heartbeatTimer) {
                    clearTimeout(_request.heartbeatTimer);
                }

                // https://github.com/Atmosphere/atmosphere/issues/1860#issuecomment-74707226
                if(_request.reconnectId) {
                    clearTimeout(_request.reconnectId);
                    delete _request.reconnectId;
                }

                if (_ieStream != null) {
                    _ieStream.close();
                    _ieStream = null;
                }
                if (_jqxhr != null) {
                    _jqxhr.abort();
                    _jqxhr = null;
                }
                if (_activeRequest != null) {
                    _activeRequest.abort();
                    _activeRequest = null;
                }
                if (_websocket != null) {
                    if (_websocket.canSendMessage) {
                        _debug("invoking .close() on WebSocket object");
                        _websocket.close();
                    }
                    _websocket = null;
                }
                if (_sse != null) {
                    _sse.close();
                    _sse = null;
                }
                _clearStorage();
            }

            function _clearStorage() {
                // Stop sharing a connection
                if (_storageService != null) {
                    // Clears trace timer
                    clearInterval(_traceTimer);
                    // Removes the trace
                    document.cookie = _sharingKey + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
                    // The heir is the parent unless unloading
                    _storageService.signal("close", {
                        reason: "",
                        heir: !_abortingConnection ? guid : (_storageService.get("children") || [])[0]
                    });
                    _storageService.close();
                }
                if (_localStorageService != null) {
                    _localStorageService.close();
                }
            }

            /**
             * Subscribe request using request transport. <br>
             * If request is currently opened, this one will be closed.
             *
             * @param {Object} Request parameters.
             * @private
             */
            function _subscribe(options) {
                _reinit();

                _request = atmosphere.util.extend(_request, options);
                // Allow at least 1 request
                _request.mrequest = _request.reconnect;
                if (!_request.reconnect) {
                    _request.reconnect = true;
                }
            }

            /**
             * Check if web socket is supported (check for custom implementation provided by request object or browser implementation).
             *
             * @returns {boolean} True if web socket is supported, false otherwise.
             * @private
             */
            function _supportWebsocket() {
                return _request.webSocketImpl != null || window.WebSocket || window.MozWebSocket;
            }

            /**
             * Check if server side events (SSE) is supported (check for custom implementation provided by request object or browser implementation).
             *
             * @returns {boolean} True if web socket is supported, false otherwise.
             * @private
             */
            function _supportSSE() {
                // Origin parts
                var url = atmosphere.util.getAbsoluteURL(_request.url.toLowerCase());
                var parts = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/.exec(url);
                var crossOrigin = !!(parts && (
                    // protocol
                parts[1] != window.location.protocol ||
                    // hostname
                parts[2] != window.location.hostname ||
                    // port
                (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (window.location.port || (window.location.protocol === "http:" ? 80 : 443))
                ));
                return window.EventSource && (!crossOrigin || !atmosphere.util.browser.safari || atmosphere.util.browser.vmajor >= 7);
            }

            /**
             * Open request using request transport. <br>
             * If request transport is 'websocket' but websocket can't be opened, request will automatically reconnect using fallback transport.
             *
             * @private
             */
            function _execute() {
                // Shared across multiple tabs/windows.
                if (_request.shared) {
                    _localStorageService = _local(_request);
                    if (_localStorageService != null) {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Storage service available. All communication will be local");
                        }

                        if (_localStorageService.open(_request)) {
                            // Local connection.
                            return;
                        }
                    }

                    if (_canLog('debug')) {
                        atmosphere.util.debug("No Storage service available.");
                    }
                    // Wasn't local or an error occurred
                    _localStorageService = null;
                }

                // Protocol
                _request.firstMessage = uuid == 0 ? true : false;
                _request.isOpen = false;
                _request.ctime = atmosphere.util.now();

                // We carry any UUID set by the user or from a previous connection.
                if (_request.uuid === 0) {
                    _request.uuid = uuid;
                }
                _response.closedByClientTimeout = false;

                if (_request.transport !== 'websocket' && _request.transport !== 'sse') {
                    _executeRequest(_request);

                } else if (_request.transport === 'websocket') {
                    if (!_supportWebsocket()) {
                        _reconnectWithFallbackTransport("Websocket is not supported, using request.fallbackTransport (" + _request.fallbackTransport
                        + ")");
                    } else {
                        _executeWebSocket(false);
                    }
                } else if (_request.transport === 'sse') {
                    if (!_supportSSE()) {
                        _reconnectWithFallbackTransport("Server Side Events(SSE) is not supported, using request.fallbackTransport ("
                        + _request.fallbackTransport + ")");
                    } else {
                        _executeSSE(false);
                    }
                }
            }

            function _local(request) {
                var trace, connector, orphan, name = "atmosphere-" + request.url, connectors = {
                    storage: function () {
                        function onstorage(event) {
                            if (event.key === name && event.newValue) {
                                listener(event.newValue);
                            }
                        }

                        if (!atmosphere.util.storage) {
                            return;
                        }

                        var storage = window.localStorage,
                            get = function (key) {
                                return atmosphere.util.parseJSON(storage.getItem(name + "-" + key));
                            },
                            set = function (key, value) {
                                storage.setItem(name + "-" + key, atmosphere.util.stringifyJSON(value));
                            };

                        return {
                            init: function () {
                                set("children", get("children").concat([guid]));
                                atmosphere.util.on(window, "storage", onstorage);
                                return get("opened");
                            },
                            signal: function (type, data) {
                                storage.setItem(name, atmosphere.util.stringifyJSON({
                                    target: "p",
                                    type: type,
                                    data: data
                                }));
                            },
                            close: function () {
                                var children = get("children");

                                atmosphere.util.off(window, "storage", onstorage);
                                if (children) {
                                    if (removeFromArray(children, request.id)) {
                                        set("children", children);
                                    }
                                }
                            }
                        };
                    },
                    windowref: function () {
                        var win = window.open("", name.replace(/\W/g, ""));

                        if (!win || win.closed || !win.callbacks) {
                            return;
                        }

                        return {
                            init: function () {
                                win.callbacks.push(listener);
                                win.children.push(guid);
                                return win.opened;
                            },
                            signal: function (type, data) {
                                if (!win.closed && win.fire) {
                                    win.fire(atmosphere.util.stringifyJSON({
                                        target: "p",
                                        type: type,
                                        data: data
                                    }));
                                }
                            },
                            close: function () {
                                // Removes traces only if the parent is alive
                                if (!orphan) {
                                    removeFromArray(win.callbacks, listener);
                                    removeFromArray(win.children, guid);
                                }
                            }

                        };
                    }
                };

                function removeFromArray(array, val) {
                    var i, length = array.length;

                    for (i = 0; i < length; i++) {
                        if (array[i] === val) {
                            array.splice(i, 1);
                        }
                    }

                    return length !== array.length;
                }

                // Receives open, close and message command from the parent
                function listener(string) {
                    var command = atmosphere.util.parseJSON(string), data = command.data;

                    if (command.target === "c") {
                        switch (command.type) {
                            case "open":
                                _open("opening", 'local', _request);
                                break;
                            case "close":
                                if (!orphan) {
                                    orphan = true;
                                    if (data.reason === "aborted") {
                                        _close();
                                    } else {
                                        // Gives the heir some time to reconnect
                                        if (data.heir === guid) {
                                            _execute();
                                        } else {
                                            setTimeout(function () {
                                                _execute();
                                            }, 100);
                                        }
                                    }
                                }
                                break;
                            case "message":
                                _prepareCallback(data, "messageReceived", 200, request.transport);
                                break;
                            case "localMessage":
                                _localMessage(data);
                                break;
                        }
                    }
                }

                function findTrace() {
                    var matcher = new RegExp("(?:^|; )(" + encodeURIComponent(name) + ")=([^;]*)").exec(document.cookie);
                    if (matcher) {
                        return atmosphere.util.parseJSON(decodeURIComponent(matcher[2]));
                    }
                }

                // Finds and validates the parent socket's trace from the cookie
                trace = findTrace();
                if (!trace || atmosphere.util.now() - trace.ts > 1000) {
                    return;
                }

                // Chooses a connector
                connector = connectors.storage() || connectors.windowref();
                if (!connector) {
                    return;
                }

                return {
                    open: function () {
                        var parentOpened;

                        // Checks the shared one is alive
                        _traceTimer = setInterval(function () {
                            var oldTrace = trace;
                            trace = findTrace();
                            if (!trace || oldTrace.ts === trace.ts) {
                                // Simulates a close signal
                                listener(atmosphere.util.stringifyJSON({
                                    target: "c",
                                    type: "close",
                                    data: {
                                        reason: "error",
                                        heir: oldTrace.heir
                                    }
                                }));
                            }
                        }, 1000);

                        parentOpened = connector.init();
                        if (parentOpened) {
                            // Firing the open event without delay robs the user of the opportunity to bind connecting event handlers
                            setTimeout(function () {
                                _open("opening", 'local', request);
                            }, 50);
                        }
                        return parentOpened;
                    },
                    send: function (event) {
                        connector.signal("send", event);
                    },
                    localSend: function (event) {
                        connector.signal("localSend", atmosphere.util.stringifyJSON({
                            id: guid,
                            event: event
                        }));
                    },
                    close: function () {
                        // Do not signal the parent if this method is executed by the unload event handler
                        if (!_abortingConnection) {
                            clearInterval(_traceTimer);
                            connector.signal("close");
                            connector.close();
                        }
                    }
                };
            }

            function share() {
                var storageService, name = "atmosphere-" + _request.url, servers = {
                    // Powered by the storage event and the localStorage
                    // http://www.w3.org/TR/webstorage/#event-storage
                    storage: function () {
                        function onstorage(event) {
                            // When a deletion, newValue initialized to null
                            if (event.key === name && event.newValue) {
                                listener(event.newValue);
                            }
                        }

                        if (!atmosphere.util.storage) {
                            return;
                        }

                        var storage = window.localStorage;

                        return {
                            init: function () {
                                // Handles the storage event
                                atmosphere.util.on(window, "storage", onstorage);
                            },
                            signal: function (type, data) {
                                storage.setItem(name, atmosphere.util.stringifyJSON({
                                    target: "c",
                                    type: type,
                                    data: data
                                }));
                            },
                            get: function (key) {
                                return atmosphere.util.parseJSON(storage.getItem(name + "-" + key));
                            },
                            set: function (key, value) {
                                storage.setItem(name + "-" + key, atmosphere.util.stringifyJSON(value));
                            },
                            close: function () {
                                atmosphere.util.off(window, "storage", onstorage);
                                storage.removeItem(name);
                                storage.removeItem(name + "-opened");
                                storage.removeItem(name + "-children");
                            }

                        };
                    },
                    // Powered by the window.open method
                    // https://developer.mozilla.org/en/DOM/window.open
                    windowref: function () {
                        // Internet Explorer raises an invalid argument error
                        // when calling the window.open method with the name containing non-word characters
                        var neim = name.replace(/\W/g, ""), container = document.getElementById(neim), win;

                        if (!container) {
                            container = document.createElement("div");
                            container.id = neim;
                            container.style.display = "none";
                            container.innerHTML = '<iframe name="' + neim + '" />';
                            document.body.appendChild(container);
                        }

                        win = container.firstChild.contentWindow;

                        return {
                            init: function () {
                                // Callbacks from different windows
                                win.callbacks = [listener];
                                // In IE 8 and less, only string argument can be safely passed to the function in other window
                                win.fire = function (string) {
                                    var i;

                                    for (i = 0; i < win.callbacks.length; i++) {
                                        win.callbacks[i](string);
                                    }
                                };
                            },
                            signal: function (type, data) {
                                if (!win.closed && win.fire) {
                                    win.fire(atmosphere.util.stringifyJSON({
                                        target: "c",
                                        type: type,
                                        data: data
                                    }));
                                }
                            },
                            get: function (key) {
                                return !win.closed ? win[key] : null;
                            },
                            set: function (key, value) {
                                if (!win.closed) {
                                    win[key] = value;
                                }
                            },
                            close: function () {
                            }
                        };
                    }
                };

                // Receives send and close command from the children
                function listener(string) {
                    var command = atmosphere.util.parseJSON(string), data = command.data;

                    if (command.target === "p") {
                        switch (command.type) {
                            case "send":
                                _push(data);
                                break;
                            case "localSend":
                                _localMessage(data);
                                break;
                            case "close":
                                _close();
                                break;
                        }
                    }
                }

                _localSocketF = function propagateMessageEvent(context) {
                    storageService.signal("message", context);
                };

                function leaveTrace() {
                    document.cookie = _sharingKey + "=" +
                        // Opera's JSON implementation ignores a number whose a last digit of 0 strangely
                        // but has no problem with a number whose a last digit of 9 + 1
                    encodeURIComponent(atmosphere.util.stringifyJSON({
                        ts: atmosphere.util.now() + 1,
                        heir: (storageService.get("children") || [])[0]
                    })) + "; path=/";
                }

                // Chooses a storageService
                storageService = servers.storage() || servers.windowref();
                storageService.init();

                if (_canLog('debug')) {
                    atmosphere.util.debug("Installed StorageService " + storageService);
                }

                // List of children sockets
                storageService.set("children", []);

                if (storageService.get("opened") != null && !storageService.get("opened")) {
                    // Flag indicating the parent socket is opened
                    storageService.set("opened", false);
                }
                // Leaves traces
                _sharingKey = encodeURIComponent(name);
                leaveTrace();
                _traceTimer = setInterval(leaveTrace, 1000);

                _storageService = storageService;
            }

            /**
             * @private
             */
            function _open(state, transport, request) {
                if (_request.shared && transport !== 'local') {
                    share();
                }

                if (_storageService != null) {
                    _storageService.set("opened", true);
                }

                request.close = function () {
                    _close();
                };

                if (_requestCount > 0 && state === 're-connecting') {
                    request.isReopen = true;
                    _tryingToReconnect(_response);
                } else if (_response.error == null) {
                    _response.request = request;
                    var prevState = _response.state;
                    _response.state = state;
                    var prevTransport = _response.transport;
                    _response.transport = transport;

                    var _body = _response.responseBody;
                    _invokeCallback();
                    _response.responseBody = _body;

                    _response.state = prevState;
                    _response.transport = prevTransport;
                }
            }

            /**
             * Execute request using jsonp transport.
             *
             * @param request {Object} request Request parameters, if undefined _request object will be used.
             * @private
             */
            function _jsonp(request) {
                // When CORS is enabled, make sure we force the proper transport.
                request.transport = "jsonp";

                var rq = _request, script;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                _jqxhr = {
                    open: function () {
                        var callback = "atmosphere" + (++guid);

                        function _reconnectOnFailure() {
                            rq.lastIndex = 0;

                            if (rq.openId) {
                                clearTimeout(rq.openId);
                            }

                            if (rq.heartbeatTimer) {
                                clearTimeout(rq.heartbeatTimer);
                            }

                            if (rq.reconnect && _requestCount++ < rq.maxReconnectOnClose) {
                                _open('re-connecting', rq.transport, rq);
                                _reconnect(_jqxhr, rq, request.reconnectInterval);
                                rq.openId = setTimeout(function () {
                                    _triggerOpen(rq);
                                }, rq.reconnectInterval + 1000);
                            } else {
                                _onError(0, "maxReconnectOnClose reached");
                            }
                        }

                        function poll() {
                            var url = rq.url;
                            if (rq.dispatchUrl != null) {
                                url += rq.dispatchUrl;
                            }

                            var data = rq.data;
                            if (rq.attachHeadersAsQueryString) {
                                url = _attachHeaders(rq);
                                if (data !== '') {
                                    url += "&X-Atmosphere-Post-Body=" + encodeURIComponent(data);
                                }
                                data = '';
                            }

                            var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;

                            script = document.createElement("script");
                            script.src = url + "&jsonpTransport=" + callback;
                            //script.async = rq.async;
                            script.clean = function () {
                                script.clean = script.onerror = script.onload = script.onreadystatechange = null;
                                if (script.parentNode) {
                                    script.parentNode.removeChild(script);
                                }

                                if (++request.scriptCount === 2) {
                                    request.scriptCount = 1;
                                    _reconnectOnFailure();
                                }

                            };
                            script.onload = script.onreadystatechange = function () {
                                _debug("jsonp.onload");
                                if (!script.readyState || /loaded|complete/.test(script.readyState)) {
                                    script.clean();
                                }
                            };

                            script.onerror = function () {
                                _debug("jsonp.onerror");
                                request.scriptCount = 1;
                                script.clean();
                            };

                            head.insertBefore(script, head.firstChild);
                        }

                        // Attaches callback
                        window[callback] = function (msg) {
                            _debug("jsonp.window");
                            request.scriptCount = 0;
                            if (rq.reconnect && rq.maxRequest === -1 || rq.requestCount++ < rq.maxRequest) {

                                // _readHeaders(_jqxhr, rq);
                                if (!rq.executeCallbackBeforeReconnect) {
                                    _reconnect(_jqxhr, rq, rq.pollingInterval);
                                }

                                if (msg != null && typeof msg !== 'string') {
                                    try {
                                        msg = msg.message;
                                    } catch (err) {
                                        // The message was partial
                                    }
                                }
                                var skipCallbackInvocation = _trackMessageSize(msg, rq, _response);
                                if (!skipCallbackInvocation) {
                                    _prepareCallback(_response.responseBody, "messageReceived", 200, rq.transport);
                                }

                                if (rq.executeCallbackBeforeReconnect) {
                                    _reconnect(_jqxhr, rq, rq.pollingInterval);
                                }
                                _timeout(rq);
                            } else {
                                atmosphere.util.log(_request.logLevel, ["JSONP reconnect maximum try reached " + _request.requestCount]);
                                _onError(0, "maxRequest reached");
                            }
                        };
                        setTimeout(function () {
                            poll();
                        }, 50);
                    },
                    abort: function () {
                        if (script && script.clean) {
                            script.clean();
                        }
                    }
                };
                _jqxhr.open();
            }

            /**
             * Build websocket object.
             *
             * @param location {string} Web socket url.
             * @returns {websocket} Web socket object.
             * @private
             */
            function _getWebSocket(location) {
                if (_request.webSocketImpl != null) {
                    return _request.webSocketImpl;
                } else {
                    if (window.WebSocket) {
                        return new WebSocket(location);
                    } else {
                        return new MozWebSocket(location);
                    }
                }
            }

            /**
             * Build web socket url from request url.
             *
             * @return {string} Web socket url (start with "ws" or "wss" for secure web socket).
             * @private
             */
            function _buildWebSocketUrl() {
                return _attachHeaders(_request, atmosphere.util.getAbsoluteURL(_request.webSocketUrl || _request.url)).replace(/^http/, "ws");
            }

            /**
             * Build SSE url from request url.
             *
             * @return a url with Atmosphere's headers
             * @private
             */
            function _buildSSEUrl() {
                var url = _attachHeaders(_request);
                return url;
            }

            /**
             * Open SSE. <br>
             * Automatically use fallback transport if SSE can't be opened.
             *
             * @private
             */
            function _executeSSE(sseOpened) {

                _response.transport = "sse";

                var location = _buildSSEUrl();

                if (_canLog('debug')) {
                    atmosphere.util.debug("Invoking executeSSE");
                    atmosphere.util.debug("Using URL: " + location);
                }

                if (sseOpened && !_request.reconnect) {
                    if (_sse != null) {
                        _clearState();
                    }
                    return;
                }

                try {
                    _sse = new EventSource(location, {
                        withCredentials: _request.withCredentials
                    });
                } catch (e) {
                    _onError(0, e);
                    _reconnectWithFallbackTransport("SSE failed. Downgrading to fallback transport and resending");
                    return;
                }

                if (_request.connectTimeout > 0) {
                    _request.id = setTimeout(function () {
                        if (!sseOpened) {
                            _clearState();
                        }
                    }, _request.connectTimeout);
                }

                _sse.onopen = function (event) {
                    _debug("sse.onopen");
                    _timeout(_request);
                    if (_canLog('debug')) {
                        atmosphere.util.debug("SSE successfully opened");
                    }

                    if (!_request.enableProtocol) {
                        if (!sseOpened) {
                            _open('opening', "sse", _request);
                        } else {
                            _open('re-opening', "sse", _request);
                        }
                    } else if (_request.isReopen) {
                        _request.isReopen = false;
                        _open('re-opening', _request.transport, _request);
                    }

                    sseOpened = true;

                    if (_request.method === 'POST') {
                        _response.state = "messageReceived";
                        _sse.send(_request.data);
                    }
                };

                _sse.onmessage = function (message) {
                    _debug("sse.onmessage");
                    _timeout(_request);

                    if (!_request.enableXDR && window.location.host && message.origin && message.origin !== window.location.protocol + "//" + window.location.host) {
                        atmosphere.util.log(_request.logLevel, ["Origin was not " + window.location.protocol + "//" + window.location.host]);
                        return;
                    }

                    _response.state = 'messageReceived';
                    _response.status = 200;

                    message = message.data;
                    var skipCallbackInvocation = _trackMessageSize(message, _request, _response);

                    // https://github.com/remy/polyfills/blob/master/EventSource.js
                    // Since we polling.
                    /* if (_sse.URL) {
                     _sse.interval = 100;
                     _sse.URL = _buildSSEUrl();
                     } */

                    if (!skipCallbackInvocation) {
                        _invokeCallback();
                        _response.responseBody = '';
                        _response.messages = [];
                    }
                };

                _sse.onerror = function (message) {
                    _debug("sse.onerror");
                    clearTimeout(_request.id);

                    if (_request.heartbeatTimer) {
                        clearTimeout(_request.heartbeatTimer);
                    }

                    if (_response.closedByClientTimeout) {
                        return;
                    }

                    _invokeClose(sseOpened);
                    _clearState();

                    if (_abortingConnection) {
                        atmosphere.util.log(_request.logLevel, ["SSE closed normally"]);
                    } else if (!sseOpened) {
                        _reconnectWithFallbackTransport("SSE failed. Downgrading to fallback transport and resending");
                    } else if (_request.reconnect && (_response.transport === 'sse')) {
                        if (_requestCount++ < _request.maxReconnectOnClose) {
                            _open('re-connecting', _request.transport, _request);
                            if (_request.reconnectInterval > 0) {
                                _request.reconnectId = setTimeout(function () {
                                    _executeSSE(true);
                                }, _request.reconnectInterval);
                            } else {
                                _executeSSE(true);
                            }
                            _response.responseBody = "";
                            _response.messages = [];
                        } else {
                            atmosphere.util.log(_request.logLevel, ["SSE reconnect maximum try reached " + _requestCount]);
                            _onError(0, "maxReconnectOnClose reached");
                        }
                    }
                };
            }

            /**
             * Open web socket. <br>
             * Automatically use fallback transport if web socket can't be opened.
             *
             * @private
             */
            function _executeWebSocket(webSocketOpened) {

                _response.transport = "websocket";

                var location = _buildWebSocketUrl(_request.url);
                if (_canLog('debug')) {
                    atmosphere.util.debug("Invoking executeWebSocket, using URL: " + location);
                }

                if (webSocketOpened && !_request.reconnect) {
                    if (_websocket != null) {
                        _clearState();
                    }
                    return;
                }

                _websocket = _getWebSocket(location);
                if (_request.webSocketBinaryType != null) {
                    _websocket.binaryType = _request.webSocketBinaryType;
                }

                if (_request.connectTimeout > 0) {
                    _request.id = setTimeout(function () {
                        if (!webSocketOpened) {
                            var _message = {
                                code: 1002,
                                reason: "",
                                wasClean: false
                            };
                            _websocket.onclose(_message);
                            // Close it anyway
                            try {
                                _clearState();
                            } catch (e) {
                            }
                            return;
                        }

                    }, _request.connectTimeout);
                }

                _websocket.onopen = function (message) {
                    _debug("websocket.onopen");
                    _timeout(_request);
                    offline = false;

                    if (_canLog('debug')) {
                        atmosphere.util.debug("Websocket successfully opened");
                    }

                    var reopening = webSocketOpened;

                    if (_websocket != null) {
                        _websocket.canSendMessage = true;
                    }

                    if (!_request.enableProtocol) {
                        webSocketOpened = true;
                        if (reopening) {
                            _open('re-opening', "websocket", _request);
                        } else {
                            _open('opening', "websocket", _request);
                        }
                    }

                    if (_websocket != null) {
                        if (_request.method === 'POST') {
                            _response.state = "messageReceived";
                            _websocket.send(_request.data);
                        }
                    }
                };

                _websocket.onmessage = function (message) {
                    _debug("websocket.onmessage");
                    _timeout(_request);

                    // We only consider it opened if we get the handshake data
                    // https://github.com/Atmosphere/atmosphere-javascript/issues/74
                    if (_request.enableProtocol) {
                        webSocketOpened = true;
                    }

                    _response.state = 'messageReceived';
                    _response.status = 200;

                    message = message.data;
                    var isString = typeof (message) === 'string';
                    if (isString) {
                        var skipCallbackInvocation = _trackMessageSize(message, _request, _response);
                        if (!skipCallbackInvocation) {
                            _invokeCallback();
                            _response.responseBody = '';
                            _response.messages = [];
                        }
                    } else {
                        message = _handleProtocol(_request, message);
                        if (message === "")
                            return;

                        _response.responseBody = message;
                        _invokeCallback();
                        _response.responseBody = null;
                    }
                };

                _websocket.onerror = function (message) {
                    _debug("websocket.onerror");
                    clearTimeout(_request.id);

                    if (_request.heartbeatTimer) {
                        clearTimeout(_request.heartbeatTimer);
                    }
                };

                _websocket.onclose = function (message) {
                    _debug("websocket.onclose");
                    clearTimeout(_request.id);
                    if (_response.state === 'closed')
                        return;

                    var reason = message.reason;
                    if (reason === "") {
                        switch (message.code) {
                            case 1000:
                                reason = "Normal closure; the connection successfully completed whatever purpose for which it was created.";
                                break;
                            case 1001:
                                reason = "The endpoint is going away, either because of a server failure or because the "
                                + "browser is navigating away from the page that opened the connection.";
                                break;
                            case 1002:
                                reason = "The endpoint is terminating the connection due to a protocol error.";
                                break;
                            case 1003:
                                reason = "The connection is being terminated because the endpoint received data of a type it "
                                + "cannot accept (for example, a text-only endpoint received binary data).";
                                break;
                            case 1004:
                                reason = "The endpoint is terminating the connection because a data frame was received that is too large.";
                                break;
                            case 1005:
                                reason = "Unknown: no status code was provided even though one was expected.";
                                break;
                            case 1006:
                                reason = "Connection was closed abnormally (that is, with no close frame being sent).";
                                break;
                        }
                    }

                    if (_canLog('warn')) {
                        atmosphere.util.warn("Websocket closed, reason: " + reason + ' - wasClean: ' + message.wasClean);
                    }

                    if (_response.closedByClientTimeout || (_request.handleOnlineOffline && offline)) {
                        // IFF online/offline events are handled and we happen to be offline, we stop all reconnect attempts and
                        // resume them in the "online" event (if we get here in that case, something else went wrong as the
                        // offline handler should stop any reconnect attempt).
                        //
                        // On the other hand, if we DO NOT handle online/offline events, we continue as before with reconnecting
                        // even if we are offline. Failing to do so would stop all reconnect attemps forever.
                        if (_request.reconnectId) {
                            clearTimeout(_request.reconnectId);
                            delete _request.reconnectId;
                        }
                        return;
                    }

                    _invokeClose(webSocketOpened);

                    _response.state = 'closed';

                    if (_abortingConnection) {
                        atmosphere.util.log(_request.logLevel, ["Websocket closed normally"]);
                    } else if (!webSocketOpened) {
                        _reconnectWithFallbackTransport("Websocket failed on first connection attempt. Downgrading to " + _request.fallbackTransport + " and resending");

                    } else if (_request.reconnect && _response.transport === 'websocket' ) {
                        _clearState();
                        if (_requestCount++ < _request.maxReconnectOnClose) {
                            _open('re-connecting', _request.transport, _request);
                            if (_request.reconnectInterval > 0) {
                                _request.reconnectId = setTimeout(function () {
                                    _response.responseBody = "";
                                    _response.messages = [];
                                    _executeWebSocket(true);
                                }, _request.reconnectInterval);
                            } else {
                                _response.responseBody = "";
                                _response.messages = [];
                                _executeWebSocket(true);
                            }
                        } else {
                            atmosphere.util.log(_request.logLevel, ["Websocket reconnect maximum try reached " + _requestCount]);
                            if (_canLog('warn')) {
                                atmosphere.util.warn("Websocket error, reason: " + message.reason);
                            }
                            _onError(0, "maxReconnectOnClose reached");
                        }
                    }
                };

                var ua = navigator.userAgent.toLowerCase();
                var isAndroid = ua.indexOf("android") > -1;
                if (isAndroid && _websocket.url === undefined) {
                    // Android 4.1 does not really support websockets and fails silently
                    _websocket.onclose({
                        reason: "Android 4.1 does not support websockets.",
                        wasClean: false
                    });
                }
            }

            function _handleProtocol(request, message) {

                var nMessage = message;
                if (request.transport === 'polling') return nMessage;

                if (request.enableProtocol && request.firstMessage && atmosphere.util.trim(message).length !== 0) {
                    var pos = request.trackMessageLength ? 1 : 0;
                    var messages = message.split(request.messageDelimiter);

                    if (messages.length <= pos + 1) {
                        // Something went wrong, normally with IE or when a message is written before the
                        // handshake has been received.
                        return nMessage;
                    }

                    request.firstMessage = false;
                    request.uuid = atmosphere.util.trim(messages[pos]);

                    if (messages.length <= pos + 2) {
                        atmosphere.util.log('error', ["Protocol data not sent by the server. " +
                        "If you enable protocol on client side, be sure to install JavascriptProtocol interceptor on server side." +
                        "Also note that atmosphere-runtime 2.2+ should be used."]);
                    }

                    _heartbeatInterval = parseInt(atmosphere.util.trim(messages[pos + 1]), 10);
                    _heartbeatPadding = messages[pos + 2];

                    if (request.transport !== 'long-polling') {
                        _triggerOpen(request);
                    }
                    uuid = request.uuid;
                    nMessage = "";

                    // We have trailing messages
                    pos = request.trackMessageLength ? 4 : 3;
                    if (messages.length > pos + 1) {
                        for (var i = pos; i < messages.length; i++) {
                            nMessage += messages[i];
                            if (i + 1 !== messages.length) {
                                nMessage += request.messageDelimiter;
                            }
                        }
                    }

                    if (request.ackInterval !== 0) {
                        setTimeout(function () {
                            _push("...ACK...");
                        }, request.ackInterval);
                    }
                } else if (request.enableProtocol && request.firstMessage && atmosphere.util.browser.msie && +atmosphere.util.browser.version.split(".")[0] < 10) {
                    // In case we are getting some junk from IE
                    atmosphere.util.log(_request.logLevel, ["Receiving unexpected data from IE"]);
                } else {
                    _triggerOpen(request);
                }
                return nMessage;
            }

            function _timeout(_request) {
                clearTimeout(_request.id);
                if (_request.timeout > 0 && _request.transport !== 'polling') {
                    _request.id = setTimeout(function () {
                        _onClientTimeout(_request);
                        _disconnect();
                        _clearState();
                    }, _request.timeout);
                }
            }

            function _onClientTimeout(_request) {
                _response.closedByClientTimeout = true;
                _response.state = 'closedByClient';
                _response.responseBody = "";
                _response.status = 408;
                _response.messages = [];
                _invokeCallback();
            }

            function _onError(code, reason) {
                _clearState();
                clearTimeout(_request.id);
                _response.state = 'error';
                _response.reasonPhrase = reason;
                _response.responseBody = "";
                _response.status = code;
                _response.messages = [];
                _invokeCallback();
            }

            /**
             * Track received message and make sure callbacks/functions are only invoked when the complete message has been received.
             *
             * @param message
             * @param request
             * @param response
             */
            function _trackMessageSize(message, request, response) {
                message = _handleProtocol(request, message);
                if (message.length === 0)
                    return true;

                response.responseBody = message;

                if (request.trackMessageLength) {
                    // prepend partialMessage if any
                    message = response.partialMessage + message;

                    var messages = [];
                    var messageStart = message.indexOf(request.messageDelimiter);
                    if (messageStart != -1) {
                        while (messageStart !== -1) {
                            var str = message.substring(0, messageStart);
                            var messageLength = +str;
                            if (isNaN(messageLength))
                                throw new Error('message length "' + str + '" is not a number');
                            messageStart += request.messageDelimiter.length;
                            if (messageStart + messageLength > message.length) {
                                // message not complete, so there is no trailing messageDelimiter
                                messageStart = -1;
                            } else {
                                // message complete, so add it
                                messages.push(message.substring(messageStart, messageStart + messageLength));
                                // remove consumed characters
                                message = message.substring(messageStart + messageLength, message.length);
                                messageStart = message.indexOf(request.messageDelimiter);
                            }
                        }

                        /* keep any remaining data */
                        response.partialMessage = message;

                        if (messages.length !== 0) {
                            response.responseBody = messages.join(request.messageDelimiter);
                            response.messages = messages;
                            return false;
                        } else {
                            response.responseBody = "";
                            response.messages = [];
                            return true;
                        }
                    }
                }
                response.responseBody = message;
                response.messages = [message];
                return false;
            }

            /**
             * Reconnect request with fallback transport. <br>
             * Used in case websocket can't be opened.
             *
             * @private
             */
            function _reconnectWithFallbackTransport(errorMessage) {
                atmosphere.util.log(_request.logLevel, [errorMessage]);

                if (typeof (_request.onTransportFailure) !== 'undefined') {
                    _request.onTransportFailure(errorMessage, _request);
                } else if (typeof (atmosphere.util.onTransportFailure) !== 'undefined') {
                    atmosphere.util.onTransportFailure(errorMessage, _request);
                }

                _request.transport = _request.fallbackTransport;
                var reconnectInterval = _request.connectTimeout === -1 ? 0 : _request.connectTimeout;
                if (_request.reconnect && _request.transport !== 'none' || _request.transport == null) {
                    _request.method = _request.fallbackMethod;
                    _response.transport = _request.fallbackTransport;
                    _request.fallbackTransport = 'none';
                    if (reconnectInterval > 0) {
                        _request.reconnectId = setTimeout(function () {
                            _execute();
                        }, reconnectInterval);
                    } else {
                        _execute();
                    }
                } else {
                    _onError(500, "Unable to reconnect with fallback transport");
                }
            }

            /**
             * Get url from request and attach headers to it.
             *
             * @param request {Object} request Request parameters, if undefined _request object will be used.
             *
             * @returns {Object} Request object, if undefined, _request object will be used.
             * @private
             */
            function _attachHeaders(request, url) {
                var rq = _request;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                if (url == null) {
                    url = rq.url;
                }

                // If not enabled
                if (!rq.attachHeadersAsQueryString)
                    return url;

                // If already added
                if (url.indexOf("X-Atmosphere-Framework") !== -1) {
                    return url;
                }

                url += (url.indexOf('?') !== -1) ? '&' : '?';
                url += "X-Atmosphere-tracking-id=" + rq.uuid;
                url += "&X-Atmosphere-Framework=" + atmosphere.version;
                url += "&X-Atmosphere-Transport=" + rq.transport;

                if (rq.trackMessageLength) {
                    url += "&X-Atmosphere-TrackMessageSize=" + "true";
                }

                if (rq.heartbeat !== null && rq.heartbeat.server !== null) {
                    url += "&X-Heartbeat-Server=" + rq.heartbeat.server;
                }

                if (rq.contentType !== '') {
                    //Eurk!
                    url += "&Content-Type=" + (rq.transport === 'websocket' ? rq.contentType : encodeURIComponent(rq.contentType));
                }

                if (rq.enableProtocol) {
                    url += "&X-atmo-protocol=true";
                }

                atmosphere.util.each(rq.headers, function (name, value) {
                    var h = atmosphere.util.isFunction(value) ? value.call(this, rq, request, _response) : value;
                    if (h != null) {
                        url += "&" + encodeURIComponent(name) + "=" + encodeURIComponent(h);
                    }
                });

                return url;
            }

            function _triggerOpen(rq) {
                if (!rq.isOpen) {
                    rq.isOpen = true;
                    _open('opening', rq.transport, rq);
                } else if (rq.isReopen) {
                    rq.isReopen = false;
                    _open('re-opening', rq.transport, rq);
                } else if (_response.state === 'messageReceived' && (rq.transport === 'jsonp' || rq.transport === 'long-polling')) {
                    _openAfterResume(_response);
                } else {
                    return;
                }

                _startHeartbeat(rq);
            }

            function _startHeartbeat(rq) {
                if (rq.heartbeatTimer != null) {
                    clearTimeout(rq.heartbeatTimer);
                }

                if (!isNaN(_heartbeatInterval) && _heartbeatInterval > 0) {
                    var _pushHeartbeat = function () {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Sending heartbeat");
                        }
                        _push(_heartbeatPadding);
                        rq.heartbeatTimer = setTimeout(_pushHeartbeat, _heartbeatInterval);
                    };
                    rq.heartbeatTimer = setTimeout(_pushHeartbeat, _heartbeatInterval);
                }
            }

            /**
             * Execute ajax request. <br>
             *
             * @param request {Object} request Request parameters, if undefined _request object will be used.
             * @private
             */
            function _executeRequest(request) {
                var rq = _request;
                if ((request != null) || (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                rq.lastIndex = 0;
                rq.readyState = 0;

                // CORS fake using JSONP
                if ((rq.transport === 'jsonp') || ((rq.enableXDR) && (atmosphere.util.checkCORSSupport()))) {
                    _jsonp(rq);
                    return;
                }

                if (atmosphere.util.browser.msie && +atmosphere.util.browser.version.split(".")[0] < 10) {
                    if ((rq.transport === 'streaming')) {
                        if (rq.enableXDR && window.XDomainRequest) {
                            _ieXDR(rq);
                        } else {
                            _ieStreaming(rq);
                        }
                        return;
                    }

                    if ((rq.enableXDR) && (window.XDomainRequest)) {
                        _ieXDR(rq);
                        return;
                    }
                }

                var reconnectFExec = function (force) {
                    rq.lastIndex = 0;
                    _requestCount++; // Increase also when forcing reconnect as _open checks _requestCount
                    if (force || (rq.reconnect && _requestCount <= rq.maxReconnectOnClose)) {
                        var delay = force ? 0 : request.reconnectInterval; // Reconnect immediately if the server resumed the connection (timeout)
                        _response.ffTryingReconnect = true;
                        _open('re-connecting', request.transport, request);
                        _reconnect(ajaxRequest, rq, delay);
                    } else {
                        _onError(0, "maxReconnectOnClose reached");
                    }
                };

                var reconnectF = function (force){
                    if(atmosphere._beforeUnloadState){
                        // ATMOSPHERE-JAVASCRIPT-143: Delay reconnect to avoid reconnect attempts before an actual unload (we don't know if an unload will happen, yet)
                        atmosphere.util.debug(new Date() + " Atmosphere: reconnectF: execution delayed due to _beforeUnloadState flag");
                        setTimeout(function () {
                            reconnectFExec(force);
                        }, 5000);
                    }else {
                        reconnectFExec(force);
                    }
                };

                var disconnected = function () {
                    // Prevent onerror callback to be called
                    _response.errorHandled = true;
                    _clearState();
                    reconnectF(false);
                };

                if (rq.force || (rq.reconnect && (rq.maxRequest === -1 || rq.requestCount++ < rq.maxRequest))) {
                    rq.force = false;

                    var ajaxRequest = atmosphere.util.xhr();
                    ajaxRequest.hasData = false;

                    _doRequest(ajaxRequest, rq, true);

                    if (rq.suspend) {
                        _activeRequest = ajaxRequest;
                    }

                    if (rq.transport !== 'polling') {
                        _response.transport = rq.transport;

                        ajaxRequest.onabort = function () {
                            _debug("ajaxrequest.onabort")
                            _invokeClose(true);
                        };

                        ajaxRequest.onerror = function () {
                            _debug("ajaxrequest.onerror")
                            _response.error = true;
                            _response.ffTryingReconnect = true;
                            try {
                                _response.status = XMLHttpRequest.status;
                            } catch (e) {
                                _response.status = 500;
                            }

                            if (!_response.status) {
                                _response.status = 500;
                            }
                            if (!_response.errorHandled) {
                                _clearState();
                                reconnectF(false);
                            }
                        };
                    }

                    ajaxRequest.onreadystatechange = function () {
                        _debug("ajaxRequest.onreadystatechange, new state: " + ajaxRequest.readyState);
                        if (_abortingConnection) {
                            _debug("onreadystatechange has been ignored due to _abortingConnection flag");
                            return;
                        }

                        _response.error = null;
                        var skipCallbackInvocation = false;
                        var update = false;

                        if (rq.transport === 'streaming' && rq.readyState > 2 && ajaxRequest.readyState === 4) {
                            _clearState();
                            reconnectF(false);
                            return;
                        }

                        rq.readyState = ajaxRequest.readyState;

                        if (rq.transport === 'streaming' && ajaxRequest.readyState >= 3) {
                            update = true;
                        } else if (rq.transport === 'long-polling' && ajaxRequest.readyState === 4) {
                            update = true;
                        }
                        _timeout(_request);

                        if (rq.transport !== 'polling') {
                            // MSIE 9 and lower status can be higher than 1000, Chrome can be 0
                            var status = 200;
                            if (ajaxRequest.readyState === 4) {
                                status = ajaxRequest.status > 1000 ? 0 : ajaxRequest.status;
                            }

                            if (!rq.reconnectOnServerError && (status >= 300 && status < 600)) {
                                _onError(status, ajaxRequest.statusText);
                                return;
                            }

                            if (status >= 300 || status === 0) {
                                disconnected();
                                return;
                            }

                            // Firefox incorrectly send statechange 0->2 when a reconnect attempt fails. The above checks ensure that onopen is not called for these
                            if ((!rq.enableProtocol || !request.firstMessage) && ajaxRequest.readyState === 2) {
                                // Firefox incorrectly send statechange 0->2 when a reconnect attempt fails. The above checks ensure that onopen is not called for these
                                // In that case, ajaxRequest.onerror will be called just after onreadystatechange is called, so we delay the trigger until we are
                                // guarantee the connection is well established.
                                if (atmosphere.util.browser.mozilla && _response.ffTryingReconnect) {
                                    _response.ffTryingReconnect = false;
                                    setTimeout(function () {
                                        if (!_response.ffTryingReconnect) {
                                            _triggerOpen(rq);
                                        }
                                    }, 500);
                                } else {
                                    _triggerOpen(rq);
                                }
                            }

                        } else if (ajaxRequest.readyState === 4) {
                            update = true;
                        }

                        if (update) {
                            var responseText = ajaxRequest.responseText;
                            _response.errorHandled = false;

                            // IE behave the same way when resuming long-polling or when the server goes down.
                            if (rq.transport === 'long-polling' && atmosphere.util.trim(responseText).length === 0) {
                                // For browser that aren't support onabort
                                if (!ajaxRequest.hasData) {
                                    reconnectF(true);
                                } else {
                                    ajaxRequest.hasData = false;
                                }
                                return;
                            }
                            ajaxRequest.hasData = true;

                            _readHeaders(ajaxRequest, _request);

                            if (rq.transport === 'streaming') {
                                if (!atmosphere.util.browser.opera) {
                                    var message = responseText.substring(rq.lastIndex, responseText.length);
                                    skipCallbackInvocation = _trackMessageSize(message, rq, _response);

                                    rq.lastIndex = responseText.length;
                                    if (skipCallbackInvocation) {
                                        return;
                                    }
                                } else {
                                    atmosphere.util.iterate(function () {
                                        if (_response.status !== 500 && ajaxRequest.responseText.length > rq.lastIndex) {
                                            try {
                                                _response.status = ajaxRequest.status;
                                                _response.headers = atmosphere.util.parseHeaders(ajaxRequest.getAllResponseHeaders());

                                                _readHeaders(ajaxRequest, _request);

                                            } catch (e) {
                                                _response.status = 404;
                                            }
                                            _timeout(_request);

                                            _response.state = "messageReceived";
                                            var message = ajaxRequest.responseText.substring(rq.lastIndex);
                                            rq.lastIndex = ajaxRequest.responseText.length;

                                            skipCallbackInvocation = _trackMessageSize(message, rq, _response);
                                            if (!skipCallbackInvocation) {
                                                _invokeCallback();
                                            }

                                            if (_verifyStreamingLength(ajaxRequest, rq)) {
                                                _reconnectOnMaxStreamingLength(ajaxRequest, rq);
                                                return;
                                            }
                                        } else if (_response.status > 400) {
                                            // Prevent replaying the last message.
                                            rq.lastIndex = ajaxRequest.responseText.length;
                                            return false;
                                        }
                                    }, 0);
                                }
                            } else {
                                skipCallbackInvocation = _trackMessageSize(responseText, rq, _response);
                            }
                            var closeStream = _verifyStreamingLength(ajaxRequest, rq);

                            try {
                                _response.status = ajaxRequest.status;
                                _response.headers = atmosphere.util.parseHeaders(ajaxRequest.getAllResponseHeaders());

                                _readHeaders(ajaxRequest, rq);
                            } catch (e) {
                                _response.status = 404;
                            }

                            if (rq.suspend) {
                                _response.state = _response.status === 0 ? "closed" : "messageReceived";
                            } else {
                                _response.state = "messagePublished";
                            }

                            var isAllowedToReconnect = !closeStream && request.transport !== 'streaming' && request.transport !== 'polling';
                            if (isAllowedToReconnect && !rq.executeCallbackBeforeReconnect) {
                                _reconnect(ajaxRequest, rq, rq.pollingInterval);
                            }

                            if (_response.responseBody.length !== 0 && !skipCallbackInvocation)
                                _invokeCallback();

                            if (isAllowedToReconnect && rq.executeCallbackBeforeReconnect) {
                                _reconnect(ajaxRequest, rq, rq.pollingInterval);
                            }

                            if (closeStream) {
                                _reconnectOnMaxStreamingLength(ajaxRequest, rq);
                            }
                        }
                    };

                    try {
                        ajaxRequest.send(rq.data);
                        _subscribed = true;
                    } catch (e) {
                        atmosphere.util.log(rq.logLevel, ["Unable to connect to " + rq.url]);
                        _onError(0, e);
                    }

                } else {
                    if (rq.logLevel === 'debug') {
                        atmosphere.util.log(rq.logLevel, ["Max re-connection reached."]);
                    }
                    _onError(0, "maxRequest reached");
                }
            }

            function _reconnectOnMaxStreamingLength(ajaxRequest, rq) {
                _response.messages = [];
                rq.isReopen = true;
                _close();
                _abortingConnection = false;
                _reconnect(ajaxRequest, rq, 500);
            }

            /**
             * Do ajax request.
             *
             * @param ajaxRequest Ajax request.
             * @param request Request parameters.
             * @param create If ajax request has to be open.
             */
            function _doRequest(ajaxRequest, request, create) {
                // Prevent Android to cache request
                var url = request.url;
                if (request.dispatchUrl != null && request.method === 'POST') {
                    url += request.dispatchUrl;
                }
                url = _attachHeaders(request, url);
                url = atmosphere.util.prepareURL(url);

                if (create) {
                    ajaxRequest.open(request.method, url, request.async);
                    if (request.connectTimeout > 0) {
                        request.id = setTimeout(function () {
                            if (request.requestCount === 0) {
                                _clearState();
                                _prepareCallback("Connect timeout", "closed", 200, request.transport);
                            }
                        }, request.connectTimeout);
                    }
                }

                if (_request.withCredentials && _request.transport !== 'websocket') {
                    if ("withCredentials" in ajaxRequest) {
                        ajaxRequest.withCredentials = true;
                    }
                }

                if (!_request.dropHeaders) {
                    ajaxRequest.setRequestHeader("X-Atmosphere-Framework", atmosphere.version);
                    ajaxRequest.setRequestHeader("X-Atmosphere-Transport", request.transport);

                    if (request.heartbeat !== null && request.heartbeat.server !== null) {
                        ajaxRequest.setRequestHeader("X-Heartbeat-Server", ajaxRequest.heartbeat.server);
                    }

                    if (request.trackMessageLength) {
                        ajaxRequest.setRequestHeader("X-Atmosphere-TrackMessageSize", "true");
                    }
                    ajaxRequest.setRequestHeader("X-Atmosphere-tracking-id", request.uuid);

                    atmosphere.util.each(request.headers, function (name, value) {
                        var h = atmosphere.util.isFunction(value) ? value.call(this, ajaxRequest, request, create, _response) : value;
                        if (h != null) {
                            ajaxRequest.setRequestHeader(name, h);
                        }
                    });
                }

                if (request.contentType !== '') {
                    ajaxRequest.setRequestHeader("Content-Type", request.contentType);
                }
            }

            function _reconnect(ajaxRequest, request, delay) {

                if (_response.closedByClientTimeout) {
                    return;
                }

                if (request.reconnect || (request.suspend && _subscribed)) {
                    var status = 0;
                    if (ajaxRequest && ajaxRequest.readyState > 1) {
                        status = ajaxRequest.status > 1000 ? 0 : ajaxRequest.status;
                    }
                    _response.status = status === 0 ? 204 : status;
                    _response.reason = status === 0 ? "Server resumed the connection or down." : "OK";

                    clearTimeout(request.id);
                    if (request.reconnectId) {
                        clearTimeout(request.reconnectId);
                        delete request.reconnectId;
                    }

                    if (delay > 0) {
                        // For whatever reason, never cancel a reconnect timeout as it is mandatory to reconnect.
                        _request.reconnectId = setTimeout(function () {
                            _executeRequest(request);
                        }, delay);
                    } else {
                        _executeRequest(request);
                    }
                }
            }

            function _tryingToReconnect(response) {
                response.state = 're-connecting';
                _invokeFunction(response);
            }

            function _openAfterResume(response) {
                response.state = 'openAfterResume';
                _invokeFunction(response);
                response.state = 'messageReceived';
            }

            function _ieXDR(request) {
                if (request.transport !== "polling") {
                    _ieStream = _configureXDR(request);
                    _ieStream.open();
                } else {
                    _configureXDR(request).open();
                }
            }

            function _configureXDR(request) {
                var rq = _request;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                var transport = rq.transport;
                var lastIndex = 0;
                var xdr = new window.XDomainRequest();
                var reconnect = function () {
                    if (rq.transport === "long-polling" && (rq.reconnect && (rq.maxRequest === -1 || rq.requestCount++ < rq.maxRequest))) {
                        xdr.status = 200;
                        _ieXDR(rq);
                    }
                };

                var rewriteURL = rq.rewriteURL || function (url) {
                        // Maintaining session by rewriting URL
                        // http://stackoverflow.com/questions/6453779/maintaining-session-by-rewriting-url
                        var match = /(?:^|;\s*)(JSESSIONID|PHPSESSID)=([^;]*)/.exec(document.cookie);

                        switch (match && match[1]) {
                            case "JSESSIONID":
                                return url.replace(/;jsessionid=[^\?]*|(\?)|$/, ";jsessionid=" + match[2] + "$1");
                            case "PHPSESSID":
                                return url.replace(/\?PHPSESSID=[^&]*&?|\?|$/, "?PHPSESSID=" + match[2] + "&").replace(/&$/, "");
                        }
                        return url;
                    };

                // Handles open and message event
                xdr.onprogress = function () {
                    handle(xdr);
                };
                // Handles error event
                xdr.onerror = function () {
                    // If the server doesn't send anything back to XDR will fail with polling
                    if (rq.transport !== 'polling') {
                        _clearState();
                        if (_requestCount++ < rq.maxReconnectOnClose) {
                            if (rq.reconnectInterval > 0) {
                                rq.reconnectId = setTimeout(function () {
                                    _open('re-connecting', request.transport, request);
                                    _ieXDR(rq);
                                }, rq.reconnectInterval);
                            } else {
                                _open('re-connecting', request.transport, request);
                                _ieXDR(rq);
                            }
                        } else {
                            _onError(0, "maxReconnectOnClose reached");
                        }
                    }
                };

                // Handles close event
                xdr.onload = function () {
                };

                var handle = function (xdr) {
                    clearTimeout(rq.id);
                    var message = xdr.responseText;

                    message = message.substring(lastIndex);
                    lastIndex += message.length;

                    if (transport !== 'polling') {
                        _timeout(rq);

                        var skipCallbackInvocation = _trackMessageSize(message, rq, _response);

                        if (transport === 'long-polling' && atmosphere.util.trim(message).length === 0)
                            return;

                        if (rq.executeCallbackBeforeReconnect) {
                            reconnect();
                        }

                        if (!skipCallbackInvocation) {
                            _prepareCallback(_response.responseBody, "messageReceived", 200, transport);
                        }

                        if (!rq.executeCallbackBeforeReconnect) {
                            reconnect();
                        }
                    }
                };

                return {
                    open: function () {
                        var url = rq.url;
                        if (rq.dispatchUrl != null) {
                            url += rq.dispatchUrl;
                        }
                        url = _attachHeaders(rq, url);
                        xdr.open(rq.method, rewriteURL(url));
                        if (rq.method === 'GET') {
                            xdr.send();
                        } else {
                            xdr.send(rq.data);
                        }

                        if (rq.connectTimeout > 0) {
                            rq.id = setTimeout(function () {
                                if (rq.requestCount === 0) {
                                    _clearState();
                                    _prepareCallback("Connect timeout", "closed", 200, rq.transport);
                                }
                            }, rq.connectTimeout);
                        }
                    },
                    close: function () {
                        xdr.abort();
                    }
                };
            }

            function _ieStreaming(request) {
                _ieStream = _configureIE(request);
                _ieStream.open();
            }

            function _configureIE(request) {
                var rq = _request;
                if ((request != null) && (typeof (request) !== 'undefined')) {
                    rq = request;
                }

                var stop;
                var doc = new window.ActiveXObject("htmlfile");

                doc.open();
                doc.close();

                var url = rq.url;
                if (rq.dispatchUrl != null) {
                    url += rq.dispatchUrl;
                }

                if (rq.transport !== 'polling') {
                    _response.transport = rq.transport;
                }

                return {
                    open: function () {
                        var iframe = doc.createElement("iframe");

                        url = _attachHeaders(rq);
                        if (rq.data !== '') {
                            url += "&X-Atmosphere-Post-Body=" + encodeURIComponent(rq.data);
                        }

                        // Finally attach a timestamp to prevent Android and IE caching.
                        url = atmosphere.util.prepareURL(url);

                        iframe.src = url;
                        doc.body.appendChild(iframe);

                        // For the server to respond in a consistent format regardless of user agent, we polls response text
                        var cdoc = iframe.contentDocument || iframe.contentWindow.document;

                        stop = atmosphere.util.iterate(function () {
                            try {
                                if (!cdoc.firstChild) {
                                    return;
                                }

                                var res = cdoc.body ? cdoc.body.lastChild : cdoc;
                                var readResponse = function () {
                                    // Clones the element not to disturb the original one
                                    var clone = res.cloneNode(true);

                                    // If the last character is a carriage return or a line feed, IE ignores it in the innerText property
                                    // therefore, we add another non-newline character to preserve it
                                    clone.appendChild(cdoc.createTextNode("."));

                                    var text = clone.innerText;

                                    text = text.substring(0, text.length - 1);
                                    return text;

                                };

                                // To support text/html content type
                                if (!cdoc.body || !cdoc.body.firstChild || cdoc.body.firstChild.nodeName.toLowerCase() !== "pre") {
                                    // Injects a plaintext element which renders text without interpreting the HTML and cannot be stopped
                                    // it is deprecated in HTML5, but still works
                                    var head = cdoc.head || cdoc.getElementsByTagName("head")[0] || cdoc.documentElement || cdoc;
                                    var script = cdoc.createElement("script");

                                    script.text = "document.write('<plaintext>')";

                                    head.insertBefore(script, head.firstChild);
                                    head.removeChild(script);

                                    // The plaintext element will be the response container
                                    res = cdoc.body.lastChild;
                                }

                                if (rq.closed) {
                                    rq.isReopen = true;
                                }

                                // Handles message and close event
                                stop = atmosphere.util.iterate(function () {
                                    var text = readResponse();
                                    if (text.length > rq.lastIndex) {
                                        _timeout(_request);

                                        _response.status = 200;
                                        _response.error = null;

                                        // Empties response every time that it is handled
                                        res.innerText = "";
                                        var skipCallbackInvocation = _trackMessageSize(text, rq, _response);
                                        if (skipCallbackInvocation) {
                                            return "";
                                        }

                                        _prepareCallback(_response.responseBody, "messageReceived", 200, rq.transport);
                                    }

                                    rq.lastIndex = 0;

                                    if (cdoc.readyState === "complete") {
                                        _invokeClose(true);
                                        _open('re-connecting', rq.transport, rq);
                                        if (rq.reconnectInterval > 0) {
                                            rq.reconnectId = setTimeout(function () {
                                                _ieStreaming(rq);
                                            }, rq.reconnectInterval);
                                        } else {
                                            _ieStreaming(rq);
                                        }
                                        return false;
                                    }
                                }, null);

                                return false;
                            } catch (err) {
                                _response.error = true;
                                _open('re-connecting', rq.transport, rq);
                                if (_requestCount++ < rq.maxReconnectOnClose) {
                                    if (rq.reconnectInterval > 0) {
                                        rq.reconnectId = setTimeout(function () {
                                            _ieStreaming(rq);
                                        }, rq.reconnectInterval);
                                    } else {
                                        _ieStreaming(rq);
                                    }
                                } else {
                                    _onError(0, "maxReconnectOnClose reached");
                                }
                                doc.execCommand("Stop");
                                doc.close();
                                return false;
                            }
                        });
                    },

                    close: function () {
                        if (stop) {
                            stop();
                        }

                        doc.execCommand("Stop");
                        _invokeClose(true);
                    }
                };
            }

            /**
             * Send message. <br>
             * Will be automatically dispatch to other connected.
             *
             * @param {Object, string} Message to send.
             * @private
             */
            function _push(message) {

                if (_localStorageService != null) {
                    _pushLocal(message);
                } else if (_activeRequest != null || _sse != null) {
                    _pushAjaxMessage(message);
                } else if (_ieStream != null) {
                    _pushIE(message);
                } else if (_jqxhr != null) {
                    _pushJsonp(message);
                } else if (_websocket != null) {
                    _pushWebSocket(message);
                } else {
                    _onError(0, "No suspended connection available");
                    atmosphere.util.error("No suspended connection available. Make sure atmosphere.subscribe has been called and request.onOpen invoked before trying to push data");
                }
            }

            function _pushOnClose(message, rq) {
                if (!rq) {
                    rq = _getPushRequest(message);
                }
                rq.transport = "polling";
                rq.method = "GET";
                rq.withCredentials = false;
                rq.reconnect = false;
                rq.force = true;
                rq.suspend = false;
                rq.timeout = 1000;
                _executeRequest(rq);
            }

            function _pushLocal(message) {
                _localStorageService.send(message);
            }

            function _intraPush(message) {
                // IE 9 will crash if not.
                if (message.length === 0)
                    return;

                try {
                    if (_localStorageService) {
                        _localStorageService.localSend(message);
                    } else if (_storageService) {
                        _storageService.signal("localMessage", atmosphere.util.stringifyJSON({
                            id: guid,
                            event: message
                        }));
                    }
                } catch (err) {
                    atmosphere.util.error(err);
                }
            }

            /**
             * Send a message using currently opened ajax request (using http-streaming or long-polling). <br>
             *
             * @param {string, Object} Message to send. This is an object, string message is saved in data member.
             * @private
             */
            function _pushAjaxMessage(message) {
                var rq = _getPushRequest(message);
                _executeRequest(rq);
            }

            /**
             * Send a message using currently opened ie streaming (using http-streaming or long-polling). <br>
             *
             * @param {string, Object} Message to send. This is an object, string message is saved in data member.
             * @private
             */
            function _pushIE(message) {
                if (_request.enableXDR && atmosphere.util.checkCORSSupport()) {
                    var rq = _getPushRequest(message);
                    // Do not reconnect since we are pushing.
                    rq.reconnect = false;
                    _jsonp(rq);
                } else {
                    _pushAjaxMessage(message);
                }
            }

            /**
             * Send a message using jsonp transport. <br>
             *
             * @param {string, Object} Message to send. This is an object, string message is saved in data member.
             * @private
             */
            function _pushJsonp(message) {
                _pushAjaxMessage(message);
            }

            function _getStringMessage(message) {
                var msg = message;
                if (typeof (msg) === 'object') {
                    msg = message.data;
                }
                return msg;
            }

            /**
             * Build request use to push message using method 'POST' <br>. Transport is defined as 'polling' and 'suspend' is set to false.
             *
             * @return {Object} Request object use to push message.
             * @private
             */
            function _getPushRequest(message) {
                var msg = _getStringMessage(message);

                var rq = {
                    connected: false,
                    timeout: 60000,
                    method: 'POST',
                    url: _request.url,
                    contentType: _request.contentType,
                    headers: _request.headers,
                    reconnect: true,
                    callback: null,
                    data: msg,
                    suspend: false,
                    maxRequest: -1,
                    logLevel: 'info',
                    requestCount: 0,
                    withCredentials: _request.withCredentials,
                    async: _request.async,
                    transport: 'polling',
                    isOpen: true,
                    attachHeadersAsQueryString: true,
                    enableXDR: _request.enableXDR,
                    uuid: _request.uuid,
                    dispatchUrl: _request.dispatchUrl,
                    enableProtocol: false,
                    messageDelimiter: '|',
                    trackMessageLength: _request.trackMessageLength,
                    maxReconnectOnClose: _request.maxReconnectOnClose,
                    heartbeatTimer: _request.heartbeatTimer,
                    heartbeat: _request.heartbeat
                };

                if (typeof (message) === 'object') {
                    rq = atmosphere.util.extend(rq, message);
                }

                return rq;
            }

            /**
             * Send a message using currently opened websocket. <br>
             *
             */
            function _pushWebSocket(message) {
                var msg = atmosphere.util.isBinary(message) ? message : _getStringMessage(message);
                var data;
                try {
                    if (_request.dispatchUrl != null) {
                        data = _request.webSocketPathDelimiter + _request.dispatchUrl + _request.webSocketPathDelimiter + msg;
                    } else {
                        data = msg;
                    }

                    if (!_websocket.canSendMessage) {
                        atmosphere.util.error("WebSocket not connected.");
                        return;
                    }

                    _websocket.send(data);

                } catch (e) {
                    _websocket.onclose = function (message) {
                    };
                    _clearState();

                    _reconnectWithFallbackTransport("Websocket failed. Downgrading to " + _request.fallbackTransport + " and resending " + message);
                    _pushAjaxMessage(message);
                }
            }

            function _localMessage(message) {
                var m = atmosphere.util.parseJSON(message);
                if (m.id !== guid) {
                    if (typeof (_request.onLocalMessage) !== 'undefined') {
                        _request.onLocalMessage(m.event);
                    } else if (typeof (atmosphere.util.onLocalMessage) !== 'undefined') {
                        atmosphere.util.onLocalMessage(m.event);
                    }
                }
            }

            function _prepareCallback(messageBody, state, errorCode, transport) {

                _response.responseBody = messageBody;
                _response.transport = transport;
                _response.status = errorCode;
                _response.state = state;

                _invokeCallback();
            }

            function _readHeaders(xdr, request) {
                if (!request.readResponsesHeaders) {
                    if (!request.enableProtocol) {
                        request.uuid = guid;
                    }
                }
                else {
                    try {

                        var tempUUID = xdr.getResponseHeader('X-Atmosphere-tracking-id');
                        if (tempUUID && tempUUID != null) {
                            request.uuid = tempUUID.split(" ").pop();
                        }
                    } catch (e) {
                    }
                }
            }

            function _invokeFunction(response) {
                _f(response, _request);
                // Global
                _f(response, atmosphere.util);
            }

            function _f(response, f) {
                switch (response.state) {
                    case "messageReceived":
                        _debug("Firing onMessage");
                        _requestCount = 0;
                        if (typeof (f.onMessage) !== 'undefined')
                            f.onMessage(response);

                        if (typeof (f.onmessage) !== 'undefined')
                            f.onmessage(response);
                        break;
                    case "error":
                        var dbgReasonPhrase = (typeof(response.reasonPhrase) != 'undefined') ? response.reasonPhrase : 'n/a';
                        _debug("Firing onError, reasonPhrase: " + dbgReasonPhrase);
                        if (typeof (f.onError) !== 'undefined')
                            f.onError(response);

                        if (typeof (f.onerror) !== 'undefined')
                            f.onerror(response);
                        break;
                    case "opening":
                        delete _request.closed;
                        _debug("Firing onOpen");
                        if (typeof (f.onOpen) !== 'undefined')
                            f.onOpen(response);

                        if (typeof (f.onopen) !== 'undefined')
                            f.onopen(response);
                        break;
                    case "messagePublished":
                        _debug("Firing messagePublished");
                        if (typeof (f.onMessagePublished) !== 'undefined')
                            f.onMessagePublished(response);
                        break;
                    case "re-connecting":
                        _debug("Firing onReconnect");
                        if (typeof (f.onReconnect) !== 'undefined')
                            f.onReconnect(_request, response);
                        break;
                    case "closedByClient":
                        _debug("Firing closedByClient");
                        if (typeof (f.onClientTimeout) !== 'undefined')
                            f.onClientTimeout(_request);
                        break;
                    case "re-opening":
                        delete _request.closed;
                        _debug("Firing onReopen");
                        if (typeof (f.onReopen) !== 'undefined')
                            f.onReopen(_request, response);
                        break;
                    case "fail-to-reconnect":
                        _debug("Firing onFailureToReconnect");
                        if (typeof (f.onFailureToReconnect) !== 'undefined')
                            f.onFailureToReconnect(_request, response);
                        break;
                    case "unsubscribe":
                    case "closed":
                        var closed = typeof (_request.closed) !== 'undefined' ? _request.closed : false;

                        if (!closed) {
                            _debug("Firing onClose (" + response.state + " case)");
                            if (typeof (f.onClose) !== 'undefined') {
                                f.onClose(response);
                            }

                            if (typeof (f.onclose) !== 'undefined') {
                                f.onclose(response);
                            }
                        } else {
                            _debug("Request already closed, not firing onClose (" + response.state + " case)");
                        }
                        _request.closed = true;
                        break;
                    case "openAfterResume":
                        if (typeof (f.onOpenAfterResume) !== 'undefined')
                            f.onOpenAfterResume(_request);
                        break;
                }
            }

            function _invokeClose(wasOpen) {
                if (_response.state !== 'closed') {
                    _response.state = 'closed';
                    _response.responseBody = "";
                    _response.messages = [];
                    _response.status = !wasOpen ? 501 : 200;
                    _invokeCallback();
                }
            }

            /**
             * Invoke request callbacks.
             *
             * @private
             */
            function _invokeCallback() {
                var call = function (index, func) {
                    func(_response);
                };

                if (_localStorageService == null && _localSocketF != null) {
                    _localSocketF(_response.responseBody);
                }

                _request.reconnect = _request.mrequest;

                var isString = typeof (_response.responseBody) === 'string';
                var messages = (isString && _request.trackMessageLength) ? (_response.messages.length > 0 ? _response.messages : ['']) : new Array(
                    _response.responseBody);
                for (var i = 0; i < messages.length; i++) {

                    if (messages.length > 1 && messages[i].length === 0) {
                        continue;
                    }
                    _response.responseBody = (isString) ? atmosphere.util.trim(messages[i]) : messages[i];

                    if (_localStorageService == null && _localSocketF != null) {
                        _localSocketF(_response.responseBody);
                    }

                    if ((_response.responseBody.length === 0 ||
                        (isString && _heartbeatPadding === _response.responseBody)) && _response.state === "messageReceived") {
                        continue;
                    }

                    _invokeFunction(_response);

                    // Invoke global callbacks
                    if (callbacks.length > 0) {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Invoking " + callbacks.length + " global callbacks: " + _response.state);
                        }
                        try {
                            atmosphere.util.each(callbacks, call);
                        } catch (e) {
                            atmosphere.util.log(_request.logLevel, ["Callback exception" + e]);
                        }
                    }

                    // Invoke request callback
                    if (typeof (_request.callback) === 'function') {
                        if (_canLog('debug')) {
                            atmosphere.util.debug("Invoking request callbacks");
                        }
                        try {
                            _request.callback(_response);
                        } catch (e) {
                            atmosphere.util.log(_request.logLevel, ["Callback exception" + e]);
                        }
                    }
                }
            }

            this.subscribe = function (options) {
                _subscribe(options);
                _execute();
            };

            this.execute = function () {
                _execute();
            };

            this.close = function () {
                _close();
            };

            this.disconnect = function () {
                _disconnect();
            };

            this.getUrl = function () {
                return _request.url;
            };

            this.push = function (message, dispatchUrl) {
                if (dispatchUrl != null) {
                    var originalDispatchUrl = _request.dispatchUrl;
                    _request.dispatchUrl = dispatchUrl;
                    _push(message);
                    _request.dispatchUrl = originalDispatchUrl;
                } else {
                    _push(message);
                }
            };

            this.getUUID = function () {
                return _request.uuid;
            };

            this.pushLocal = function (message) {
                _intraPush(message);
            };

            this.enableProtocol = function (message) {
                return _request.enableProtocol;
            };

            this.init = function () {
                _init();
            };

            this.request = _request;
            this.response = _response;
        }
    };

    atmosphere.subscribe = function (url, callback, request) {
        if (typeof (callback) === 'function') {
            atmosphere.addCallback(callback);
        }

        if (typeof (url) !== "string") {
            request = url;
        } else {
            request.url = url;
        }

        // https://github.com/Atmosphere/atmosphere-javascript/issues/58
        uuid = ((typeof (request) !== 'undefined') && typeof (request.uuid) !== 'undefined') ? request.uuid : 0;

        var rq = new atmosphere.AtmosphereRequest(request);
        rq.execute();

        requests[requests.length] = rq;
        return rq;
    };

    atmosphere.unsubscribe = function () {
        if (requests.length > 0) {
            var requestsClone = [].concat(requests);
            for (var i = 0; i < requestsClone.length; i++) {
                var rq = requestsClone[i];
                rq.close();
                clearTimeout(rq.response.request.id);

                if (rq.heartbeatTimer) {
                    clearTimeout(rq.heartbeatTimer);
                }
            }
        }
        requests = [];
        callbacks = [];
    };

    atmosphere.unsubscribeUrl = function (url) {
        var idx = -1;
        if (requests.length > 0) {
            for (var i = 0; i < requests.length; i++) {
                var rq = requests[i];

                // Suppose you can subscribe once to an url
                if (rq.getUrl() === url) {
                    rq.close();
                    clearTimeout(rq.response.request.id);

                    if (rq.heartbeatTimer) {
                        clearTimeout(rq.heartbeatTimer);
                    }

                    idx = i;
                    break;
                }
            }
        }
        if (idx >= 0) {
            requests.splice(idx, 1);
        }
    };

    atmosphere.addCallback = function (func) {
        if (atmosphere.util.inArray(func, callbacks) === -1) {
            callbacks.push(func);
        }
    };

    atmosphere.removeCallback = function (func) {
        var index = atmosphere.util.inArray(func, callbacks);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    };

    atmosphere.util = {
        browser: {},

        parseHeaders: function (headerString) {
            var match, rheaders = /^(.*?):[ \t]*([^\r\n]*)\r?$/mg, headers = {};
            while (match = rheaders.exec(headerString)) {
                headers[match[1]] = match[2];
            }
            return headers;
        },

        now: function () {
            return new Date().getTime();
        },

        isArray: function (array) {
            return Object.prototype.toString.call(array) === "[object Array]";
        },

        inArray: function (elem, array) {
            if (!Array.prototype.indexOf) {
                var len = array.length;
                for (var i = 0; i < len; ++i) {
                    if (array[i] === elem) {
                        return i;
                    }
                }
                return -1;
            }
            return array.indexOf(elem);
        },

        isBinary: function (data) {
            // True if data is an instance of Blob, ArrayBuffer or ArrayBufferView
            return /^\[object\s(?:Blob|ArrayBuffer|.+Array)\]$/.test(Object.prototype.toString.call(data));
        },

        isFunction: function (fn) {
            return Object.prototype.toString.call(fn) === "[object Function]";
        },

        getAbsoluteURL: function (url) {
            if (typeof (document.createElement) === 'undefined') {
                // assuming the url to be already absolute when DOM is not supported
                return url;
            }
            var div = document.createElement("div");

            // Uses an innerHTML property to obtain an absolute URL
            div.innerHTML = '<a href="' + url + '"/>';

            // encodeURI and decodeURI are needed to normalize URL between IE and non-IE,
            // since IE doesn't encode the href property value and return it - http://jsfiddle.net/Yq9M8/1/
            return encodeURI(decodeURI(div.firstChild.href));
        },

        prepareURL: function (url) {
            // Attaches a time stamp to prevent caching
            var ts = atmosphere.util.now();
            var ret = url.replace(/([?&])_=[^&]*/, "$1_=" + ts);

            return ret + (ret === url ? (/\?/.test(url) ? "&" : "?") + "_=" + ts : "");
        },

        trim: function (str) {
            if (!String.prototype.trim) {
                return str.toString().replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, "").replace(/\s+/g, " ");
            } else {
                return str.toString().trim();
            }
        },

        param: function (params) {
            var prefix, s = [];

            function add(key, value) {
                value = atmosphere.util.isFunction(value) ? value() : (value == null ? "" : value);
                s.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
            }

            function buildParams(prefix, obj) {
                var name;

                if (atmosphere.util.isArray(obj)) {
                    atmosphere.util.each(obj, function (i, v) {
                        if (/\[\]$/.test(prefix)) {
                            add(prefix, v);
                        } else {
                            buildParams(prefix + "[" + (typeof v === "object" ? i : "") + "]", v);
                        }
                    });
                } else if (Object.prototype.toString.call(obj) === "[object Object]") {
                    for (name in obj) {
                        buildParams(prefix + "[" + name + "]", obj[name]);
                    }
                } else {
                    add(prefix, obj);
                }
            }

            for (prefix in params) {
                buildParams(prefix, params[prefix]);
            }

            return s.join("&").replace(/%20/g, "+");
        },

        storage: function () {
            try {
                return !!(window.localStorage && window.StorageEvent);
            } catch (e) {
                //Firefox throws an exception here, see
                //https://bugzilla.mozilla.org/show_bug.cgi?id=748620
                return false;
            }
        },

        iterate: function (fn, interval) {
            var timeoutId;

            // Though the interval is 0 for real-time application, there is a delay between setTimeout calls
            // For detail, see https://developer.mozilla.org/en/window.setTimeout#Minimum_delay_and_timeout_nesting
            interval = interval || 0;

            (function loop() {
                timeoutId = setTimeout(function () {
                    if (fn() === false) {
                        return;
                    }

                    loop();
                }, interval);
            })();

            return function () {
                clearTimeout(timeoutId);
            };
        },

        each: function (obj, callback, args) {
            if (!obj) return;
            var value, i = 0, length = obj.length, isArray = atmosphere.util.isArray(obj);

            if (args) {
                if (isArray) {
                    for (; i < length; i++) {
                        value = callback.apply(obj[i], args);

                        if (value === false) {
                            break;
                        }
                    }
                } else {
                    for (i in obj) {
                        value = callback.apply(obj[i], args);

                        if (value === false) {
                            break;
                        }
                    }
                }

                // A special, fast, case for the most common use of each
            } else {
                if (isArray) {
                    for (; i < length; i++) {
                        value = callback.call(obj[i], i, obj[i]);

                        if (value === false) {
                            break;
                        }
                    }
                } else {
                    for (i in obj) {
                        value = callback.call(obj[i], i, obj[i]);

                        if (value === false) {
                            break;
                        }
                    }
                }
            }

            return obj;
        },

        extend: function (target) {
            var i, options, name;

            for (i = 1; i < arguments.length; i++) {
                if ((options = arguments[i]) != null) {
                    for (name in options) {
                        target[name] = options[name];
                    }
                }
            }

            return target;
        },
        on: function (elem, type, fn) {
            if (elem.addEventListener) {
                elem.addEventListener(type, fn, false);
            } else if (elem.attachEvent) {
                elem.attachEvent("on" + type, fn);
            }
        },
        off: function (elem, type, fn) {
            if (elem.removeEventListener) {
                elem.removeEventListener(type, fn, false);
            } else if (elem.detachEvent) {
                elem.detachEvent("on" + type, fn);
            }
        },

        log: function (level, args) {
            if (window.console) {
                var logger = window.console[level];
                if (typeof logger === 'function') {
                    logger.apply(window.console, args);
                }
            }
        },

        warn: function () {
            atmosphere.util.log('warn', arguments);
        },

        info: function () {
            atmosphere.util.log('info', arguments);
        },

        debug: function () {
            atmosphere.util.log('debug', arguments);
        },

        error: function () {
            atmosphere.util.log('error', arguments);
        },
        xhr: function () {
            try {
                return new window.XMLHttpRequest();
            } catch (e1) {
                try {
                    return new window.ActiveXObject("Microsoft.XMLHTTP");
                } catch (e2) {
                }
            }
        },
        parseJSON: function (data) {
            return !data ? null : window.JSON && window.JSON.parse ? window.JSON.parse(data) : new Function("return " + data)();
        },
        // http://github.com/flowersinthesand/stringifyJSON
        stringifyJSON: function (value) {
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, meta = {
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };

            function quote(string) {
                return '"' + string.replace(escapable, function (a) {
                        var c = meta[a];
                        return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
                    }) + '"';
            }

            function f(n) {
                return n < 10 ? "0" + n : n;
            }

            return window.JSON && window.JSON.stringify ? window.JSON.stringify(value) : (function str(key, holder) {
                var i, v, len, partial, value = holder[key], type = typeof value;

                if (value && typeof value === "object" && typeof value.toJSON === "function") {
                    value = value.toJSON(key);
                    type = typeof value;
                }

                switch (type) {
                    case "string":
                        return quote(value);
                    case "number":
                        return isFinite(value) ? String(value) : "null";
                    case "boolean":
                        return String(value);
                    case "object":
                        if (!value) {
                            return "null";
                        }

                        switch (Object.prototype.toString.call(value)) {
                            case "[object Date]":
                                return isFinite(value.valueOf()) ? '"' + value.getUTCFullYear() + "-" + f(value.getUTCMonth() + 1) + "-"
                                + f(value.getUTCDate()) + "T" + f(value.getUTCHours()) + ":" + f(value.getUTCMinutes()) + ":" + f(value.getUTCSeconds())
                                + "Z" + '"' : "null";
                            case "[object Array]":
                                len = value.length;
                                partial = [];
                                for (i = 0; i < len; i++) {
                                    partial.push(str(i, value) || "null");
                                }

                                return "[" + partial.join(",") + "]";
                            default:
                                partial = [];
                                for (i in value) {
                                    if (hasOwn.call(value, i)) {
                                        v = str(i, value);
                                        if (v) {
                                            partial.push(quote(i) + ":" + v);
                                        }
                                    }
                                }

                                return "{" + partial.join(",") + "}";
                        }
                }
            })("", {
                "": value
            });
        },

        checkCORSSupport: function () {
            if (atmosphere.util.browser.msie && !window.XDomainRequest && +atmosphere.util.browser.version.split(".")[0] < 11) {
                return true;
            } else if (atmosphere.util.browser.opera && +atmosphere.util.browser.version.split(".") < 12.0) {
                return true;
            }

            // KreaTV 4.1 -> 4.4
            else if (atmosphere.util.trim(navigator.userAgent).slice(0, 16) === "KreaTVWebKit/531") {
                return true;
            }
            // KreaTV 3.8
            else if (atmosphere.util.trim(navigator.userAgent).slice(-7).toLowerCase() === "kreatel") {
                return true;
            }

            // Force older Android versions to use CORS as some version like 2.2.3 fail otherwise
            var ua = navigator.userAgent.toLowerCase();
            var androidVersionMatches = ua.match(/.+android ([0-9]{1,2})/i),
                majorVersion = parseInt((androidVersionMatches && androidVersionMatches[0]) || -1, 10);
            if (!isNaN(majorVersion) && majorVersion > -1 && majorVersion < 3) {
                return true;
            }
            return false;
        }
    };

    guid = atmosphere.util.now();

    // Browser sniffing
    (function () {
        var ua = navigator.userAgent.toLowerCase(),
            match = /(chrome)[ \/]([\w.]+)/.exec(ua) ||
                /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
                /(msie) ([\w.]+)/.exec(ua) ||
                /(trident)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
                ua.indexOf("android") < 0 && /version\/(.+) (safari)/.exec(ua) ||
                ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
                [];

        // Swaps variables
        if (match[2] === "safari") {
            match[2] = match[1];
            match[1] = "safari";
        }
        atmosphere.util.browser[match[1] || ""] = true;
        atmosphere.util.browser.version = match[2] || "0";
        atmosphere.util.browser.vmajor = atmosphere.util.browser.version.split(".")[0];

        // Trident is the layout engine of the Internet Explorer
        // IE 11 has no "MSIE: 11.0" token
        if (atmosphere.util.browser.trident) {
            atmosphere.util.browser.msie = true;
        }

        // The storage event of Internet Explorer and Firefox 3 works strangely
        if (atmosphere.util.browser.msie || (atmosphere.util.browser.mozilla && +atmosphere.util.browser.version.split(".")[0] === 1)) {
            atmosphere.util.storage = false;
        }
    })();

    atmosphere.util.on(window, "unload", function (event) {
        atmosphere.util.debug(new Date() + " Atmosphere: " + "unload event");
        atmosphere.unsubscribe();
    });

    atmosphere.util.on(window, "beforeunload", function (event) {
        atmosphere.util.debug(new Date() + " Atmosphere: " + "beforeunload event");

        // ATMOSPHERE-JAVASCRIPT-143: Delay reconnect to avoid reconnect attempts before an actual unload (we don't know if an unload will happen, yet)
        atmosphere._beforeUnloadState = true;
        setTimeout(function () {
            atmosphere.util.debug(new Date() + " Atmosphere: " + "beforeunload event timeout reached. Reset _beforeUnloadState flag");
            atmosphere._beforeUnloadState = false;
        }, 5000);
    });

    // Pressing ESC key in Firefox kills the connection
    // for your information, this is fixed in Firefox 20
    // https://bugzilla.mozilla.org/show_bug.cgi?id=614304
    atmosphere.util.on(window, "keypress", function (event) {
        if (event.charCode === 27 || event.keyCode === 27) {
            if (event.preventDefault) {
                event.preventDefault();
            }
        }
    });

    atmosphere.util.on(window, "offline", function () {
        atmosphere.util.debug(new Date() + " Atmosphere: offline event");
        offline = true;
        if (requests.length > 0) {
            var requestsClone = [].concat(requests);
            for (var i = 0; i < requestsClone.length; i++) {
                var rq = requestsClone[i];
                if(rq.request.handleOnlineOffline) {
                    rq.close();
                    clearTimeout(rq.response.request.id);

                    if (rq.heartbeatTimer) {
                        clearTimeout(rq.heartbeatTimer);
                    }
                }
            }
        }
    });

    atmosphere.util.on(window, "online", function () {
        atmosphere.util.debug(new Date() + " Atmosphere: online event");
        if (requests.length > 0) {
            for (var i = 0; i < requests.length; i++) {
                if(requests[i].request.handleOnlineOffline) {
                    requests[i].init();
                    requests[i].execute();
                }
            }
        }
        offline = false;
    });

    return atmosphere;
}));
/* jshint eqnull:true, noarg:true, noempty:true, eqeqeq:true, evil:true, laxbreak:true, undef:true, browser:true, indent:false, maxerr:50 */

/*! @license Firebase v4.2.0
Build: rev-d6b2db4
Terms: https://firebase.google.com/terms/

---

typedarray.js
Copyright (c) 2010, Linden Research, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE. */

var firebase=function(){var e=void 0===e?self:e;return function(t){function n(e){if(o[e])return o[e].exports;var r=o[e]={i:e,l:!1,exports:{}};return t[e].call(r.exports,r,r.exports,n),r.l=!0,r.exports}var r=e.webpackJsonpFirebase;e.webpackJsonpFirebase=function(e,o,c){for(var s,a,u,f=0,l=[];f<e.length;f++)a=e[f],i[a]&&l.push(i[a][0]),i[a]=0;for(s in o)Object.prototype.hasOwnProperty.call(o,s)&&(t[s]=o[s]);for(r&&r(e,o,c);l.length;)l.shift()();if(c)for(f=0;f<c.length;f++)u=n(n.s=c[f]);return u};var o={},i={3:0};return n.e=function(e){function t(){s.onerror=s.onload=null,clearTimeout(a);var t=i[e];0!==t&&(t&&t[1](Error("Loading chunk "+e+" failed.")),i[e]=void 0)}var r=i[e];if(0===r)return new Promise(function(e){e()});if(r)return r[2];var o=new Promise(function(t,n){r=i[e]=[t,n]});r[2]=o;var c=document.getElementsByTagName("head")[0],s=document.createElement("script");s.type="text/javascript",s.charset="utf-8",s.async=!0,s.timeout=12e4,n.nc&&s.setAttribute("nonce",n.nc),s.src=n.p+""+e+".js";var a=setTimeout(t,12e4);return s.onerror=s.onload=t,c.appendChild(s),o},n.m=t,n.c=o,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{configurable:!1,enumerable:!0,get:r})},n.n=function(e){var t=e&&e.t?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n.oe=function(e){throw console.error(e),e},n(n.s=5)}([,,,,function(e,t,n){"use strict";n.d(t,"b",function(){return o}),n.d(t,"a",function(){return i}),n.d(t,"c",function(){return c});var r=n(14),o=r.a.Promise||n(20),i=function(){function e(){var e=this;this.resolve=null,this.reject=null,this.promise=new o(function(t,n){e.resolve=t,e.reject=n})}return e.prototype.wrapCallback=function(e){function t(t,r){t?n.reject(t):n.resolve(r),"function"==typeof e&&(c(n.promise),1===e.length?e(t):e(t,r))}var n=this;return t},e}(),c=function(e){e.catch(function(){})}},function(e,t,n){"use strict";function r(){function e(e){v(y[e],"delete"),delete y[e]}function t(e){return e=e||f,u(y,e)||o("no-app",{name:e}),y[e]}function n(e,t){void 0===t?t=f:"string"==typeof t&&""!==t||o("bad-app-name",{name:t+""}),u(y,t)&&o("duplicate-app",{name:t});var n=new p(e,t,g);return y[t]=n,v(n,"create"),n}function l(){return Object.keys(y).map(function(e){return y[e]})}function h(e,n,r,i,c){b[e]&&o("duplicate-service",{name:e}),b[e]=n,i&&(_[e]=i,l().forEach(function(e){i("create",e)}));var s=function(n){return void 0===n&&(n=t()),"function"!=typeof n[e]&&o("invalid-app-argument",{name:e}),n[e]()};return void 0!==r&&Object(a.b)(s,r),g[e]=s,p.prototype[e]=function(){for(var t=[],n=0;n<arguments.length;n++)t[n]=arguments[n];return this.r.bind(this,e).apply(this,c?t:[])},s}function d(e){Object(a.b)(g,e)}function v(e,t){Object.keys(b).forEach(function(n){var r=m(e,n);null!==r&&_[r]&&_[r](t,e)})}function m(e,t){if("serverAuth"===t)return null;var n=t;return e.options,n}var y={},b={},_={},g={t:!0,initializeApp:n,app:t,apps:null,Promise:s.b,SDK_VERSION:"4.2.0",INTERNAL:{registerService:h,createFirebaseNamespace:r,extendNamespace:d,createSubscribe:i.a,ErrorFactory:c.a,removeApp:e,factories:b,useAsService:m,Promise:s.b,deepExtend:a.b}};return Object(a.c)(g,"default",g),Object.defineProperty(g,"apps",{get:l}),Object(a.c)(t,"App",p),g}function o(e,t){throw d.create(e,t)}Object.defineProperty(t,"__esModule",{value:!0});var i=n(13),c=n(10),s=n(4),a=n(17),u=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},f="[DEFAULT]",l=[],p=function(){function e(e,t,n){this.u=n,this.f=!1,this.h={},this.v=t,this.y=Object(a.a)(e),this.INTERNAL={getUid:function(){return null},getToken:function(){return s.b.resolve(null)},addAuthTokenListener:function(e){l.push(e),setTimeout(function(){return e(null)},0)},removeAuthTokenListener:function(e){l=l.filter(function(t){return t!==e})}}}return Object.defineProperty(e.prototype,"name",{get:function(){return this._(),this.v},enumerable:!0,configurable:!0}),Object.defineProperty(e.prototype,"options",{get:function(){return this._(),this.y},enumerable:!0,configurable:!0}),e.prototype.delete=function(){var e=this;return new s.b(function(t){e._(),t()}).then(function(){e.u.INTERNAL.removeApp(e.v);var t=[];return Object.keys(e.h).forEach(function(n){Object.keys(e.h[n]).forEach(function(r){t.push(e.h[n][r])})}),s.b.all(t.map(function(e){return e.INTERNAL.delete()}))}).then(function(){e.f=!0,e.h={}})},e.prototype.r=function(e,t){if(void 0===t&&(t=f),this._(),this.h[e]||(this.h[e]={}),!this.h[e][t]){var n=t!==f?t:void 0,r=this.u.INTERNAL.factories[e](this,this.extendApp.bind(this),n);this.h[e][t]=r}return this.h[e][t]},e.prototype.extendApp=function(e){var t=this;Object(a.b)(this,e),e.INTERNAL&&e.INTERNAL.addAuthTokenListener&&(l.forEach(function(e){t.INTERNAL.addAuthTokenListener(e)}),l=[])},e.prototype._=function(){this.f&&o("app-deleted",{name:this.v})},e}();p.prototype.name&&p.prototype.options||p.prototype.delete||console.log("dc");var h={"no-app":"No Firebase App '{$name}' has been created - call Firebase App.initializeApp()","bad-app-name":"Illegal App name: '{$name}","duplicate-app":"Firebase App named '{$name}' already exists","app-deleted":"Firebase App named '{$name}' already deleted","duplicate-service":"Firebase service named '{$name}' already registered","sa-not-supported":"Initializing the Firebase SDK with a service account is only allowed in a Node.js environment. On client devices, you should instead initialize the SDK with an api key and auth domain","invalid-app-argument":"firebase.{$name}() takes either no argument or a Firebase App instance."},d=new c.a("app","Firebase",h),v=n(19),m=(n.n(v),r());t.default=m},,,,,function(e,t,n){"use strict";n.d(t,"a",function(){return c});var r="FirebaseError",o=Error.captureStackTrace,i=function(){function e(e,t){if(this.code=e,this.message=t,o)o(this,c.prototype.create);else{var n=Error.apply(this,arguments);this.name=r,Object.defineProperty(this,"stack",{get:function(){return n.stack}})}}return e}();i.prototype=Object.create(Error.prototype),i.prototype.constructor=i,i.prototype.name=r;var c=function(){function e(e,t,n){this.service=e,this.serviceName=t,this.errors=n,this.pattern=/\{\$([^}]+)}/g}return e.prototype.create=function(e,t){void 0===t&&(t={});var n,r=this.errors[e],o=this.service+"/"+e;n=void 0===r?"Error":r.replace(this.pattern,function(e,n){var r=t[n];return void 0!==r?""+r:"<"+n+"?>"}),n=this.serviceName+": "+n+" ("+o+").";var c=new i(o,n);for(var s in t)t.hasOwnProperty(s)&&"_"!==s.slice(-1)&&(c[s]=t[s]);return c},e}()},,,function(e,t,n){"use strict";function r(e,t){var n=new a(e,t);return n.subscribe.bind(n)}function o(e,t){if("object"!==(void 0===e?"undefined":s(e))||null===e)return!1;for(var n=0,r=t;n<r.length;n++){var o=r[n];if(o in e&&"function"==typeof e[o])return!0}return!1}function i(){}t.a=r;var c=n(4),s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},a=function(){function e(e,t){var n=this;this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=c.b.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(function(){e(n)}).catch(function(e){n.error(e)})}return e.prototype.next=function(e){this.forEachObserver(function(t){t.next(e)})},e.prototype.error=function(e){this.forEachObserver(function(t){t.error(e)}),this.close(e)},e.prototype.complete=function(){this.forEachObserver(function(e){e.complete()}),this.close()},e.prototype.subscribe=function(e,t,n){var r,c=this;if(void 0===e&&void 0===t&&void 0===n)throw Error("Missing Observer.");r=o(e,["next","error","complete"])?e:{next:e,error:t,complete:n},void 0===r.next&&(r.next=i),void 0===r.error&&(r.error=i),void 0===r.complete&&(r.complete=i);var s=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(function(){try{c.finalError?r.error(c.finalError):r.complete()}catch(e){}}),this.observers.push(r),s},e.prototype.unsubscribeOne=function(e){void 0!==this.observers&&void 0!==this.observers[e]&&(delete this.observers[e],this.observerCount-=1,0===this.observerCount&&void 0!==this.onNoObservers&&this.onNoObservers(this))},e.prototype.forEachObserver=function(e){if(!this.finalized)for(var t=0;t<this.observers.length;t++)this.sendOne(t,e)},e.prototype.sendOne=function(e,t){var n=this;this.task.then(function(){if(void 0!==n.observers&&void 0!==n.observers[e])try{t(n.observers[e])}catch(e){"undefined"!=typeof console&&console.error&&console.error(e)}})},e.prototype.close=function(e){var t=this;this.finalized||(this.finalized=!0,void 0!==e&&(this.finalError=e),this.task.then(function(){t.observers=void 0,t.onNoObservers=void 0}))},e}()},function(e,t,n){"use strict";(function(e){n.d(t,"a",function(){return o});var r;if(void 0!==e)r=e;else if("undefined"!=typeof self)r=self;else try{r=Function("return this")()}catch(e){throw Error("polyfill failed because global object is unavailable in this environment")}var o=r}).call(t,n(15))},function(t,n){var r;r=function(){return this}();try{r=r||Function("return this")()||(0,eval)("this")}catch(t){"object"==typeof e&&(r=e)}t.exports=r},function(e,t){function n(){throw Error("setTimeout has not been defined")}function r(){throw Error("clearTimeout has not been defined")}function o(e){if(f===setTimeout)return setTimeout(e,0);if((f===n||!f)&&setTimeout)return f=setTimeout,setTimeout(e,0);try{return f(e,0)}catch(t){try{return f.call(null,e,0)}catch(t){return f.call(this,e,0)}}}function i(e){if(l===clearTimeout)return clearTimeout(e);if((l===r||!l)&&clearTimeout)return l=clearTimeout,clearTimeout(e);try{return l(e)}catch(t){try{return l.call(null,e)}catch(t){return l.call(this,e)}}}function c(){v&&h&&(v=!1,h.length?d=h.concat(d):m=-1,d.length&&s())}function s(){if(!v){var e=o(c);v=!0;for(var t=d.length;t;){for(h=d,d=[];++m<t;)h&&h[m].run();m=-1,t=d.length}h=null,v=!1,i(e)}}function a(e,t){this.fun=e,this.array=t}function u(){}var f,l,p=e.exports={};!function(){try{f="function"==typeof setTimeout?setTimeout:n}catch(e){f=n}try{l="function"==typeof clearTimeout?clearTimeout:r}catch(e){l=r}}();var h,d=[],v=!1,m=-1;p.nextTick=function(e){var t=Array(arguments.length-1);if(arguments.length>1)for(var n=1;n<arguments.length;n++)t[n-1]=arguments[n];d.push(new a(e,t)),1!==d.length||v||o(s)},a.prototype.run=function(){this.fun.apply(null,this.array)},p.title="browser",p.browser=!0,p.env={},p.argv=[],p.version="",p.versions={},p.on=u,p.addListener=u,p.once=u,p.off=u,p.removeListener=u,p.removeAllListeners=u,p.emit=u,p.prependListener=u,p.prependOnceListener=u,p.listeners=function(e){return[]},p.binding=function(e){throw Error("process.binding is not supported")},p.cwd=function(){return"/"},p.chdir=function(e){throw Error("process.chdir is not supported")},p.umask=function(){return 0}},function(e,t,n){"use strict";function r(e){return o(void 0,e)}function o(e,t){if(!(t instanceof Object))return t;switch(t.constructor){case Date:var n=t;return new Date(n.getTime());case Object:void 0===e&&(e={});break;case Array:e=[];break;default:return t}for(var r in t)t.hasOwnProperty(r)&&(e[r]=o(e[r],t[r]));return e}function i(e,t,n){e[t]=n}t.a=r,t.b=o,t.c=i},,function(e,t){Array.prototype.findIndex||Object.defineProperty(Array.prototype,"findIndex",{value:function(e){if(null==this)throw new TypeError('"this" is null or not defined');var t=Object(this),n=t.length>>>0;if("function"!=typeof e)throw new TypeError("predicate must be a function");for(var r=arguments[1],o=0;o<n;){var i=t[o];if(e.call(r,i,o,t))return o;o++}return-1}}),Array.prototype.find||Object.defineProperty(Array.prototype,"find",{value:function(e){if(null==this)throw new TypeError('"this" is null or not defined');var t=Object(this),n=t.length>>>0;if("function"!=typeof e)throw new TypeError("predicate must be a function");for(var r=arguments[1],o=0;o<n;){var i=t[o];if(e.call(r,i,o,t))return i;o++}}})},function(e,t,n){(function(t){!function(n){function r(){}function o(e,t){return function(){e.apply(t,arguments)}}function i(e){if("object"!=typeof this)throw new TypeError("Promises must be constructed via new");if("function"!=typeof e)throw new TypeError("not a function");this.g=0,this.T=!1,this.w=void 0,this.O=[],l(e,this)}function c(e,t){for(;3===e.g;)e=e.w;if(0===e.g)return void e.O.push(t);e.T=!0,i.j(function(){var n=1===e.g?t.onFulfilled:t.onRejected;if(null===n)return void(1===e.g?s:a)(t.promise,e.w);var r;try{r=n(e.w)}catch(e){return void a(t.promise,e)}s(t.promise,r)})}function s(e,t){try{if(t===e)throw new TypeError("A promise cannot be resolved with itself.");if(t&&("object"==typeof t||"function"==typeof t)){var n=t.then;if(t instanceof i)return e.g=3,e.w=t,void u(e);if("function"==typeof n)return void l(o(n,t),e)}e.g=1,e.w=t,u(e)}catch(t){a(e,t)}}function a(e,t){e.g=2,e.w=t,u(e)}function u(e){2===e.g&&0===e.O.length&&i.j(function(){e.T||i.A(e.w)});for(var t=0,n=e.O.length;t<n;t++)c(e,e.O[t]);e.O=null}function f(e,t,n){this.onFulfilled="function"==typeof e?e:null,this.onRejected="function"==typeof t?t:null,this.promise=n}function l(e,t){var n=!1;try{e(function(e){n||(n=!0,s(t,e))},function(e){n||(n=!0,a(t,e))})}catch(e){if(n)return;n=!0,a(t,e)}}var p=setTimeout;i.prototype.catch=function(e){return this.then(null,e)},i.prototype.then=function(e,t){var n=new this.constructor(r);return c(this,new f(e,t,n)),n},i.all=function(e){var t=Array.prototype.slice.call(e);return new i(function(e,n){function r(i,c){try{if(c&&("object"==typeof c||"function"==typeof c)){var s=c.then;if("function"==typeof s)return void s.call(c,function(e){r(i,e)},n)}t[i]=c,0==--o&&e(t)}catch(e){n(e)}}if(0===t.length)return e([]);for(var o=t.length,i=0;i<t.length;i++)r(i,t[i])})},i.resolve=function(e){return e&&"object"==typeof e&&e.constructor===i?e:new i(function(t){t(e)})},i.reject=function(e){return new i(function(t,n){n(e)})},i.race=function(e){return new i(function(t,n){for(var r=0,o=e.length;r<o;r++)e[r].then(t,n)})},i.j="function"==typeof t&&function(e){t(e)}||function(e){p(e,0)},i.A=function(e){"undefined"!=typeof console&&console&&console.warn("Possible Unhandled Promise Rejection:",e)},i.k=function(e){i.j=e},i.I=function(e){i.A=e},void 0!==e&&e.exports?e.exports=i:n.Promise||(n.Promise=i)}(this)}).call(t,n(21).setImmediate)},function(t,n,r){function o(e,t){this.F=e,this.N=t}var i=Function.prototype.apply;n.setTimeout=function(){return new o(i.call(setTimeout,e,arguments),clearTimeout)},n.setInterval=function(){return new o(i.call(setInterval,e,arguments),clearInterval)},n.clearTimeout=n.clearInterval=function(e){e&&e.close()},o.prototype.unref=o.prototype.ref=function(){},o.prototype.close=function(){this.N.call(e,this.F)},n.enroll=function(e,t){clearTimeout(e.x),e.P=t},n.unenroll=function(e){clearTimeout(e.x),e.P=-1},n.L=n.active=function(e){clearTimeout(e.x);var t=e.P;t>=0&&(e.x=setTimeout(function(){e.S&&e.S()},t))},r(22),n.setImmediate=setImmediate,n.clearImmediate=clearImmediate},function(e,t,n){(function(e,t){!function(e,n){"use strict";function r(e){"function"!=typeof e&&(e=Function(""+e));for(var t=Array(arguments.length-1),n=0;n<t.length;n++)t[n]=arguments[n+1];var r={callback:e,args:t};return u[a]=r,s(a),a++}function o(e){delete u[e]}function i(e){var t=e.callback,r=e.args;switch(r.length){case 0:t();break;case 1:t(r[0]);break;case 2:t(r[0],r[1]);break;case 3:t(r[0],r[1],r[2]);break;default:t.apply(n,r)}}function c(e){if(f)setTimeout(c,0,e);else{var t=u[e];if(t){f=!0;try{i(t)}finally{o(e),f=!1}}}}if(!e.setImmediate){var s,a=1,u={},f=!1,l=e.document,p=Object.getPrototypeOf&&Object.getPrototypeOf(e);p=p&&p.setTimeout?p:e,"[object process]"==={}.toString.call(e.process)?function(){s=function(e){t.nextTick(function(){c(e)})}}():function(){if(e.postMessage&&!e.importScripts){var t=!0,n=e.onmessage;return e.onmessage=function(){t=!1},e.postMessage("","*"),e.onmessage=n,t}}()?function(){var t="setImmediate$"+Math.random()+"$",n=function(n){n.source===e&&"string"==typeof n.data&&0===n.data.indexOf(t)&&c(+n.data.slice(t.length))};e.addEventListener?e.addEventListener("message",n,!1):e.attachEvent("onmessage",n),s=function(n){e.postMessage(t+n,"*")}}():e.MessageChannel?function(){var e=new MessageChannel;e.port1.onmessage=function(e){c(e.data)},s=function(t){e.port2.postMessage(t)}}():l&&"onreadystatechange"in l.createElement("script")?function(){var e=l.documentElement;s=function(t){var n=l.createElement("script");n.onreadystatechange=function(){c(t),n.onreadystatechange=null,e.removeChild(n),n=null},e.appendChild(n)}}():function(){s=function(e){setTimeout(c,0,e)}}(),p.setImmediate=r,p.clearImmediate=o}}("undefined"==typeof self?void 0===e?this:e:self)}).call(t,n(15),n(16))}])}().default;

(function(){var h,aa=aa||{},k=this,ba=function(a){return void 0!==a},m=function(a){return"string"==typeof a},ca=function(a){return"boolean"==typeof a},da=function(a){return"number"==typeof a},ea=function(){},fa=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&
!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b},ha=function(a){return null===a},ia=function(a){return"array"==fa(a)},ja=function(a){var b=fa(a);return"array"==b||"object"==b&&"number"==typeof a.length},p=function(a){return"function"==fa(a)},q=function(a){var b=
typeof a;return"object"==b&&null!=a||"function"==b},ka=function(a,b,c){return a.call.apply(a.bind,arguments)},la=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}},r=function(a,b,c){r=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ka:la;return r.apply(null,
arguments)},ma=function(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}},na=Date.now||function(){return+new Date},t=function(a,b){function c(){}c.prototype=b.prototype;a.Sc=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.Cg=function(a,c,f){for(var d=Array(arguments.length-2),e=2;e<arguments.length;e++)d[e-2]=arguments[e];return b.prototype[c].apply(a,d)}};var u=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,u);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};t(u,Error);u.prototype.name="CustomError";var oa=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")},pa=String.prototype.trim?function(a){return a.trim()}:function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},xa=function(a){if(!qa.test(a))return a;-1!=a.indexOf("&")&&(a=a.replace(ra,"&amp;"));-1!=a.indexOf("<")&&(a=a.replace(sa,"&lt;"));-1!=a.indexOf(">")&&(a=a.replace(ta,"&gt;"));-1!=a.indexOf('"')&&(a=a.replace(ua,"&quot;"));-1!=a.indexOf("'")&&
(a=a.replace(va,"&#39;"));-1!=a.indexOf("\x00")&&(a=a.replace(wa,"&#0;"));return a},ra=/&/g,sa=/</g,ta=/>/g,ua=/"/g,va=/'/g,wa=/\x00/g,qa=/[\x00&<>"']/,v=function(a,b){return-1!=a.indexOf(b)},ya=function(a,b){return a<b?-1:a>b?1:0};var za=function(a,b){b.unshift(a);u.call(this,oa.apply(null,b));b.shift()};t(za,u);za.prototype.name="AssertionError";
var Aa=function(a,b,c,d){var e="Assertion failed";if(c){e+=": "+c;var f=d}else a&&(e+=": "+a,f=b);throw new za(""+e,f||[]);},w=function(a,b,c){a||Aa("",null,b,Array.prototype.slice.call(arguments,2));return a},Ba=function(a,b){throw new za("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));},Ca=function(a,b,c){da(a)||Aa("Expected number but got %s: %s.",[fa(a),a],b,Array.prototype.slice.call(arguments,2));return a},Da=function(a,b,c){m(a)||Aa("Expected string but got %s: %s.",[fa(a),
a],b,Array.prototype.slice.call(arguments,2))},Ea=function(a,b,c){p(a)||Aa("Expected function but got %s: %s.",[fa(a),a],b,Array.prototype.slice.call(arguments,2))};var Ga=function(){this.Rc="";this.$e=Fa};Ga.prototype.mb=!0;Ga.prototype.kb=function(){return this.Rc};Ga.prototype.toString=function(){return"Const{"+this.Rc+"}"};var Ha=function(a){if(a instanceof Ga&&a.constructor===Ga&&a.$e===Fa)return a.Rc;Ba("expected object of type Const, got '"+a+"'");return"type_error:Const"},Fa={},Ia=function(a){var b=new Ga;b.Rc=a;return b};Ia("");var Ka=function(){this.Kc="";this.af=Ja};Ka.prototype.mb=!0;Ka.prototype.kb=function(){return this.Kc};Ka.prototype.toString=function(){return"TrustedResourceUrl{"+this.Kc+"}"};
var La=function(a){if(a instanceof Ka&&a.constructor===Ka&&a.af===Ja)return a.Kc;Ba("expected object of type TrustedResourceUrl, got '"+a+"' of type "+fa(a));return"type_error:TrustedResourceUrl"},Na=function(a,b){a=Ma(a,b);b=new Ka;b.Kc=a;return b},Ma=function(a,b){var c=Ha(a);if(!Oa.test(c))throw Error("Invalid TrustedResourceUrl format: "+c);return c.replace(Pa,function(a,e){if(!Object.prototype.hasOwnProperty.call(b,e))throw Error('Found marker, "'+e+'", in format string, "'+c+'", but no valid label mapping found in args: '+
JSON.stringify(b));a=b[e];return a instanceof Ga?Ha(a):encodeURIComponent(String(a))})},Pa=/%{(\w+)}/g,Oa=/^(?:https:)?\/\/[0-9a-z.:[\]-]+\/|^\/[^\/\\]|^about:blank(#|$)/i,Ja={};var Qa=Array.prototype.indexOf?function(a,b,c){w(null!=a.length);return Array.prototype.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(m(a))return m(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},x=Array.prototype.forEach?function(a,b,c){w(null!=a.length);Array.prototype.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=m(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},Ra=function(a,b){for(var c=m(a)?
a.split(""):a,d=a.length-1;0<=d;--d)d in c&&b.call(void 0,c[d],d,a)},Sa=Array.prototype.map?function(a,b,c){w(null!=a.length);return Array.prototype.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=m(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},Ta=Array.prototype.some?function(a,b,c){w(null!=a.length);return Array.prototype.some.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=m(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return!0;return!1},
Va=function(a){a:{var b=Ua;for(var c=a.length,d=m(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){b=e;break a}b=-1}return 0>b?null:m(a)?a.charAt(b):a[b]},Wa=function(a,b){return 0<=Qa(a,b)},Ya=function(a,b){b=Qa(a,b);var c;(c=0<=b)&&Xa(a,b);return c},Xa=function(a,b){w(null!=a.length);return 1==Array.prototype.splice.call(a,b,1).length},Za=function(a,b){var c=0;Ra(a,function(d,e){b.call(void 0,d,e,a)&&Xa(a,e)&&c++})},$a=function(a){return Array.prototype.concat.apply([],arguments)},
ab=function(a){var b=a.length;if(0<b){for(var c=Array(b),d=0;d<b;d++)c[d]=a[d];return c}return[]};var bb=function(a){return Sa(a,function(a){a=a.toString(16);return 1<a.length?a:"0"+a}).join("")};var cb;a:{var db=k.navigator;if(db){var eb=db.userAgent;if(eb){cb=eb;break a}}cb=""}var y=function(a){return v(cb,a)};var fb=function(a,b){for(var c in a)b.call(void 0,a[c],c,a)},gb=function(a,b){for(var c in a)if(b.call(void 0,a[c],c,a))return!0;return!1},hb=function(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b},ib=function(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b},jb=function(a){for(var b in a)return!1;return!0},kb=function(a,b){for(var c in a)if(!(c in b)||a[c]!==b[c])return!1;for(c in b)if(!(c in a))return!1;return!0},lb=function(a){var b={},c;for(c in a)b[c]=a[c];return b},mb="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" "),
nb=function(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<mb.length;f++)c=mb[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}};var ob=function(a){ob[" "](a);return a};ob[" "]=ea;var qb=function(a,b){var c=pb;return Object.prototype.hasOwnProperty.call(c,a)?c[a]:c[a]=b(a)};var rb=y("Opera"),z=y("Trident")||y("MSIE"),sb=y("Edge"),tb=sb||z,ub=y("Gecko")&&!(v(cb.toLowerCase(),"webkit")&&!y("Edge"))&&!(y("Trident")||y("MSIE"))&&!y("Edge"),vb=v(cb.toLowerCase(),"webkit")&&!y("Edge"),xb=function(){var a=k.document;return a?a.documentMode:void 0},yb;
a:{var zb="",Ab=function(){var a=cb;if(ub)return/rv\:([^\);]+)(\)|;)/.exec(a);if(sb)return/Edge\/([\d\.]+)/.exec(a);if(z)return/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(vb)return/WebKit\/(\S+)/.exec(a);if(rb)return/(?:Version)[ \/]?(\S+)/.exec(a)}();Ab&&(zb=Ab?Ab[1]:"");if(z){var Bb=xb();if(null!=Bb&&Bb>parseFloat(zb)){yb=String(Bb);break a}}yb=zb}
var Cb=yb,pb={},A=function(a){return qb(a,function(){for(var b=0,c=pa(String(Cb)).split("."),d=pa(String(a)).split("."),e=Math.max(c.length,d.length),f=0;0==b&&f<e;f++){var g=c[f]||"",l=d[f]||"";do{g=/(\d*)(\D*)(.*)/.exec(g)||["","","",""];l=/(\d*)(\D*)(.*)/.exec(l)||["","","",""];if(0==g[0].length&&0==l[0].length)break;b=ya(0==g[1].length?0:parseInt(g[1],10),0==l[1].length?0:parseInt(l[1],10))||ya(0==g[2].length,0==l[2].length)||ya(g[2],l[2]);g=g[3];l=l[3]}while(0==b)}return 0<=b})},Db;var Eb=k.document;
Db=Eb&&z?xb()||("CSS1Compat"==Eb.compatMode?parseInt(Cb,10):5):void 0;var Fb=null,Gb=null,Ib=function(a){var b="";Hb(a,function(a){b+=String.fromCharCode(a)});return b},Hb=function(a,b){function c(b){for(;d<a.length;){var c=a.charAt(d++),e=Gb[c];if(null!=e)return e;if(!/^[\s\xa0]*$/.test(c))throw Error("Unknown base64 encoding at char: "+c);}return b}Jb();for(var d=0;;){var e=c(-1),f=c(0),g=c(64),l=c(64);if(64===l&&-1===e)break;b(e<<2|f>>4);64!=g&&(b(f<<4&240|g>>2),64!=l&&b(g<<6&192|l))}},Jb=function(){if(!Fb){Fb={};Gb={};for(var a=0;65>a;a++)Fb[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),
Gb[Fb[a]]=a,62<=a&&(Gb["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a)]=a)}};var Kb=function(){this.Ia=-1};var Nb=function(a,b){this.Ia=64;this.oc=k.Uint8Array?new Uint8Array(this.Ia):Array(this.Ia);this.Vc=this.nb=0;this.l=[];this.Sf=a;this.we=b;this.tg=k.Int32Array?new Int32Array(64):Array(64);ba(Lb)||(Lb=k.Int32Array?new Int32Array(Mb):Mb);this.reset()},Lb;t(Nb,Kb);for(var Ob=[],Pb=0;63>Pb;Pb++)Ob[Pb]=0;var Qb=$a(128,Ob);Nb.prototype.reset=function(){this.Vc=this.nb=0;this.l=k.Int32Array?new Int32Array(this.we):ab(this.we)};
var Rb=function(a){var b=a.oc;w(b.length==a.Ia);for(var c=a.tg,d=0,e=0;e<b.length;)c[d++]=b[e]<<24|b[e+1]<<16|b[e+2]<<8|b[e+3],e=4*d;for(b=16;64>b;b++){d=c[b-15]|0;e=c[b-2]|0;e=(e>>>17|e<<15)^(e>>>19|e<<13)^e>>>10;var f=(c[b-16]|0)+((d>>>7|d<<25)^(d>>>18|d<<14)^d>>>3)|0;var g=(c[b-7]|0)+e|0;c[b]=f+g|0}d=a.l[0]|0;e=a.l[1]|0;var l=a.l[2]|0,n=a.l[3]|0,C=a.l[4]|0,wb=a.l[5]|0,ec=a.l[6]|0;f=a.l[7]|0;for(b=0;64>b;b++){var mi=((d>>>2|d<<30)^(d>>>13|d<<19)^(d>>>22|d<<10))+(d&e^d&l^e&l)|0;g=C&wb^~C&ec;f=f+
((C>>>6|C<<26)^(C>>>11|C<<21)^(C>>>25|C<<7))|0;g=g+(Lb[b]|0)|0;g=f+(g+(c[b]|0)|0)|0;f=ec;ec=wb;wb=C;C=n+g|0;n=l;l=e;e=d;d=g+mi|0}a.l[0]=a.l[0]+d|0;a.l[1]=a.l[1]+e|0;a.l[2]=a.l[2]+l|0;a.l[3]=a.l[3]+n|0;a.l[4]=a.l[4]+C|0;a.l[5]=a.l[5]+wb|0;a.l[6]=a.l[6]+ec|0;a.l[7]=a.l[7]+f|0};
Nb.prototype.update=function(a,b){ba(b)||(b=a.length);var c=0,d=this.nb;if(m(a))for(;c<b;)this.oc[d++]=a.charCodeAt(c++),d==this.Ia&&(Rb(this),d=0);else if(ja(a))for(;c<b;){var e=a[c++];if(!("number"==typeof e&&0<=e&&255>=e&&e==(e|0)))throw Error("message must be a byte array");this.oc[d++]=e;d==this.Ia&&(Rb(this),d=0)}else throw Error("message must be string or array");this.nb=d;this.Vc+=b};
Nb.prototype.digest=function(){var a=[],b=8*this.Vc;56>this.nb?this.update(Qb,56-this.nb):this.update(Qb,this.Ia-(this.nb-56));for(var c=63;56<=c;c--)this.oc[c]=b&255,b/=256;Rb(this);for(c=b=0;c<this.Sf;c++)for(var d=24;0<=d;d-=8)a[b++]=this.l[c]>>d&255;return a};
var Mb=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,
4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];var Tb=function(){Nb.call(this,8,Sb)};t(Tb,Nb);var Sb=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];var Ub=function(){this.Ka=this.Ka;this.Hc=this.Hc};Ub.prototype.Ka=!1;Ub.prototype.isDisposed=function(){return this.Ka};Ub.prototype.ib=function(){if(this.Hc)for(;this.Hc.length;)this.Hc.shift()()};var Vb=!z||9<=Number(Db),Wb=z&&!A("9");!vb||A("528");ub&&A("1.9b")||z&&A("8")||rb&&A("9.5")||vb&&A("528");ub&&!A("8")||z&&A("9");var Xb=function(){if(!k.addEventListener||!Object.defineProperty)return!1;var a=!1,b=Object.defineProperty({},"passive",{get:function(){a=!0}});k.addEventListener("test",ea,b);k.removeEventListener("test",ea,b);return a}();var B=function(a,b){this.type=a;this.currentTarget=this.target=b;this.defaultPrevented=this.Ua=!1;this.Je=!0};B.prototype.stopPropagation=function(){this.Ua=!0};B.prototype.preventDefault=function(){this.defaultPrevented=!0;this.Je=!1};var Yb=function(a,b){B.call(this,a?a.type:"");this.relatedTarget=this.currentTarget=this.target=null;this.button=this.screenY=this.screenX=this.clientY=this.clientX=this.offsetY=this.offsetX=0;this.key="";this.charCode=this.keyCode=0;this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1;this.fa=this.state=null;a&&this.init(a,b)};t(Yb,B);
Yb.prototype.init=function(a,b){var c=this.type=a.type,d=a.changedTouches?a.changedTouches[0]:null;this.target=a.target||a.srcElement;this.currentTarget=b;if(b=a.relatedTarget){if(ub){a:{try{ob(b.nodeName);var e=!0;break a}catch(f){}e=!1}e||(b=null)}}else"mouseover"==c?b=a.fromElement:"mouseout"==c&&(b=a.toElement);this.relatedTarget=b;null===d?(this.offsetX=vb||void 0!==a.offsetX?a.offsetX:a.layerX,this.offsetY=vb||void 0!==a.offsetY?a.offsetY:a.layerY,this.clientX=void 0!==a.clientX?a.clientX:a.pageX,
this.clientY=void 0!==a.clientY?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0):(this.clientX=void 0!==d.clientX?d.clientX:d.pageX,this.clientY=void 0!==d.clientY?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0);this.button=a.button;this.keyCode=a.keyCode||0;this.key=a.key||"";this.charCode=a.charCode||("keypress"==c?a.keyCode:0);this.ctrlKey=a.ctrlKey;this.altKey=a.altKey;this.shiftKey=a.shiftKey;this.metaKey=a.metaKey;this.state=a.state;this.fa=a;a.defaultPrevented&&
this.preventDefault()};Yb.prototype.stopPropagation=function(){Yb.Sc.stopPropagation.call(this);this.fa.stopPropagation?this.fa.stopPropagation():this.fa.cancelBubble=!0};Yb.prototype.preventDefault=function(){Yb.Sc.preventDefault.call(this);var a=this.fa;if(a.preventDefault)a.preventDefault();else if(a.returnValue=!1,Wb)try{if(a.ctrlKey||112<=a.keyCode&&123>=a.keyCode)a.keyCode=-1}catch(b){}};Yb.prototype.wf=function(){return this.fa};var Zb="closure_listenable_"+(1E6*Math.random()|0),$b=0;var ac=function(a,b,c,d,e){this.listener=a;this.Lc=null;this.src=b;this.type=c;this.capture=!!d;this.uc=e;this.key=++$b;this.yb=this.nc=!1},bc=function(a){a.yb=!0;a.listener=null;a.Lc=null;a.src=null;a.uc=null};var cc=function(a){this.src=a;this.J={};this.hc=0};cc.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.J[f];a||(a=this.J[f]=[],this.hc++);var g=dc(a,b,d,e);-1<g?(b=a[g],c||(b.nc=!1)):(b=new ac(b,this.src,f,!!d,e),b.nc=c,a.push(b));return b};cc.prototype.remove=function(a,b,c,d){a=a.toString();if(!(a in this.J))return!1;var e=this.J[a];b=dc(e,b,c,d);return-1<b?(bc(e[b]),Xa(e,b),0==e.length&&(delete this.J[a],this.hc--),!0):!1};
var fc=function(a,b){var c=b.type;c in a.J&&Ya(a.J[c],b)&&(bc(b),0==a.J[c].length&&(delete a.J[c],a.hc--))};cc.prototype.od=function(a,b,c,d){a=this.J[a.toString()];var e=-1;a&&(e=dc(a,b,c,d));return-1<e?a[e]:null};cc.prototype.hasListener=function(a,b){var c=ba(a),d=c?a.toString():"",e=ba(b);return gb(this.J,function(a){for(var f=0;f<a.length;++f)if(!(c&&a[f].type!=d||e&&a[f].capture!=b))return!0;return!1})};
var dc=function(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.yb&&f.listener==b&&f.capture==!!c&&f.uc==d)return e}return-1};var gc="closure_lm_"+(1E6*Math.random()|0),hc={},ic=0,kc=function(a,b,c,d,e){if(d&&d.once)jc(a,b,c,d,e);else if(ia(b))for(var f=0;f<b.length;f++)kc(a,b[f],c,d,e);else c=lc(c),a&&a[Zb]?a.listen(b,c,q(d)?!!d.capture:!!d,e):mc(a,b,c,!1,d,e)},mc=function(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var g=q(e)?!!e.capture:!!e,l=nc(a);l||(a[gc]=l=new cc(a));c=l.add(b,c,d,g,f);if(!c.Lc){d=oc();c.Lc=d;d.src=a;d.listener=c;if(a.addEventListener)Xb||(e=g),void 0===e&&(e=!1),a.addEventListener(b.toString(),
d,e);else if(a.attachEvent)a.attachEvent(pc(b.toString()),d);else throw Error("addEventListener and attachEvent are unavailable.");ic++}},oc=function(){var a=qc,b=Vb?function(c){return a.call(b.src,b.listener,c)}:function(c){c=a.call(b.src,b.listener,c);if(!c)return c};return b},jc=function(a,b,c,d,e){if(ia(b))for(var f=0;f<b.length;f++)jc(a,b[f],c,d,e);else c=lc(c),a&&a[Zb]?rc(a,b,c,q(d)?!!d.capture:!!d,e):mc(a,b,c,!0,d,e)},sc=function(a,b,c,d,e){if(ia(b))for(var f=0;f<b.length;f++)sc(a,b[f],c,d,
e);else d=q(d)?!!d.capture:!!d,c=lc(c),a&&a[Zb]?a.ea.remove(String(b),c,d,e):a&&(a=nc(a))&&(b=a.od(b,c,d,e))&&tc(b)},tc=function(a){if(!da(a)&&a&&!a.yb){var b=a.src;if(b&&b[Zb])fc(b.ea,a);else{var c=a.type,d=a.Lc;b.removeEventListener?b.removeEventListener(c,d,a.capture):b.detachEvent&&b.detachEvent(pc(c),d);ic--;(c=nc(b))?(fc(c,a),0==c.hc&&(c.src=null,b[gc]=null)):bc(a)}}},pc=function(a){return a in hc?hc[a]:hc[a]="on"+a},vc=function(a,b,c,d){var e=!0;if(a=nc(a))if(b=a.J[b.toString()])for(b=b.concat(),
a=0;a<b.length;a++){var f=b[a];f&&f.capture==c&&!f.yb&&(f=uc(f,d),e=e&&!1!==f)}return e},uc=function(a,b){var c=a.listener,d=a.uc||a.src;a.nc&&tc(a);return c.call(d,b)},qc=function(a,b){if(a.yb)return!0;if(!Vb){if(!b)a:{b=["window","event"];for(var c=k,d;d=b.shift();)if(null!=c[d])c=c[d];else{b=null;break a}b=c}d=b;b=new Yb(d,this);c=!0;if(!(0>d.keyCode||void 0!=d.returnValue)){a:{var e=!1;if(0==d.keyCode)try{d.keyCode=-1;break a}catch(g){e=!0}if(e||void 0==d.returnValue)d.returnValue=!0}d=[];for(e=
b.currentTarget;e;e=e.parentNode)d.push(e);e=a.type;for(var f=d.length-1;!b.Ua&&0<=f;f--)b.currentTarget=d[f],a=vc(d[f],e,!0,b),c=c&&a;for(f=0;!b.Ua&&f<d.length;f++)b.currentTarget=d[f],a=vc(d[f],e,!1,b),c=c&&a}return c}return uc(a,new Yb(b,this))},nc=function(a){a=a[gc];return a instanceof cc?a:null},wc="__closure_events_fn_"+(1E9*Math.random()>>>0),lc=function(a){w(a,"Listener can not be null.");if(p(a))return a;w(a.handleEvent,"An object listener must have handleEvent method.");a[wc]||(a[wc]=function(b){return a.handleEvent(b)});
return a[wc]};var xc=/^[+a-zA-Z0-9_.!#$%&'*\/=?^`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]{2,63}$/;var zc=function(){this.wa="";this.Ze=yc};zc.prototype.mb=!0;zc.prototype.kb=function(){return this.wa};zc.prototype.toString=function(){return"SafeUrl{"+this.wa+"}"};
var Ac=function(a){if(a instanceof zc&&a.constructor===zc&&a.Ze===yc)return a.wa;Ba("expected object of type SafeUrl, got '"+a+"' of type "+fa(a));return"type_error:SafeUrl"},Bc=/^(?:(?:https?|mailto|ftp):|[^:/?#]*(?:[/?#]|$))/i,Dc=function(a){if(a instanceof zc)return a;a=a.mb?a.kb():String(a);Bc.test(a)||(a="about:invalid#zClosurez");return Cc(a)},yc={},Cc=function(a){var b=new zc;b.wa=a;return b};Cc("about:blank");var Gc=function(a){var b=[];Ec(new Fc,a,b);return b.join("")},Fc=function(){this.Mc=void 0},Ec=function(a,b,c){if(null==b)c.push("null");else{if("object"==typeof b){if(ia(b)){var d=b;b=d.length;c.push("[");for(var e="",f=0;f<b;f++)c.push(e),e=d[f],Ec(a,a.Mc?a.Mc.call(d,String(f),e):e,c),e=",";c.push("]");return}if(b instanceof String||b instanceof Number||b instanceof Boolean)b=b.valueOf();else{c.push("{");f="";for(d in b)Object.prototype.hasOwnProperty.call(b,d)&&(e=b[d],"function"!=typeof e&&(c.push(f),
Hc(d,c),c.push(":"),Ec(a,a.Mc?a.Mc.call(b,d,e):e,c),f=","));c.push("}");return}}switch(typeof b){case "string":Hc(b,c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?String(b):"null");break;case "boolean":c.push(String(b));break;case "function":c.push("null");break;default:throw Error("Unknown type: "+typeof b);}}},Ic={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},Jc=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g,
Hc=function(a,b){b.push('"',a.replace(Jc,function(a){var b=Ic[a];b||(b="\\u"+(a.charCodeAt(0)|65536).toString(16).substr(1),Ic[a]=b);return b}),'"')};var Kc=function(){};Kc.prototype.be=null;var Lc=function(a){return a.be||(a.be=a.wd())};var Mc,Nc=function(){};t(Nc,Kc);Nc.prototype.pc=function(){var a=Oc(this);return a?new ActiveXObject(a):new XMLHttpRequest};Nc.prototype.wd=function(){var a={};Oc(this)&&(a[0]=!0,a[1]=!0);return a};
var Oc=function(a){if(!a.ve&&"undefined"==typeof XMLHttpRequest&&"undefined"!=typeof ActiveXObject){for(var b=["MSXML2.XMLHTTP.6.0","MSXML2.XMLHTTP.3.0","MSXML2.XMLHTTP","Microsoft.XMLHTTP"],c=0;c<b.length;c++){var d=b[c];try{return new ActiveXObject(d),a.ve=d}catch(e){}}throw Error("Could not create ActiveXObject. ActiveX might be disabled, or MSXML might not be installed");}return a.ve};Mc=new Nc;var Pc=function(){};t(Pc,Kc);Pc.prototype.pc=function(){var a=new XMLHttpRequest;if("withCredentials"in a)return a;if("undefined"!=typeof XDomainRequest)return new Qc;throw Error("Unsupported browser");};Pc.prototype.wd=function(){return{}};
var Qc=function(){this.na=new XDomainRequest;this.readyState=0;this.onreadystatechange=null;this.responseText="";this.status=-1;this.statusText=this.responseXML=null;this.na.onload=r(this.zf,this);this.na.onerror=r(this.qe,this);this.na.onprogress=r(this.Af,this);this.na.ontimeout=r(this.Bf,this)};h=Qc.prototype;h.open=function(a,b,c){if(null!=c&&!c)throw Error("Only async requests are supported.");this.na.open(a,b)};
h.send=function(a){if(a)if("string"==typeof a)this.na.send(a);else throw Error("Only string data is supported");else this.na.send()};h.abort=function(){this.na.abort()};h.setRequestHeader=function(){};h.getResponseHeader=function(a){return"content-type"==a.toLowerCase()?this.na.contentType:""};h.zf=function(){this.status=200;this.responseText=this.na.responseText;Rc(this,4)};h.qe=function(){this.status=500;this.responseText="";Rc(this,4)};h.Bf=function(){this.qe()};
h.Af=function(){this.status=200;Rc(this,1)};var Rc=function(a,b){a.readyState=b;if(a.onreadystatechange)a.onreadystatechange()};Qc.prototype.getAllResponseHeaders=function(){return"content-type: "+this.na.contentType};var Sc=function(a,b,c){this.Of=c;this.kf=a;this.cg=b;this.Gc=0;this.vc=null};Sc.prototype.get=function(){if(0<this.Gc){this.Gc--;var a=this.vc;this.vc=a.next;a.next=null}else a=this.kf();return a};Sc.prototype.put=function(a){this.cg(a);this.Gc<this.Of&&(this.Gc++,a.next=this.vc,this.vc=a)};var Tc=function(a){k.setTimeout(function(){throw a;},0)},Uc,Vc=function(){var a=k.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&!y("Presto")&&(a=function(){var a=document.createElement("IFRAME");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow;a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host;
a=r(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&!y("Trident")&&!y("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(ba(c.next)){c=c.next;var a=c.fe;c.fe=null;a()}};return function(a){d.next={fe:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("SCRIPT")?
function(a){var b=document.createElement("SCRIPT");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){k.setTimeout(a,0)}};var Wc=function(){this.$c=this.eb=null},Yc=new Sc(function(){return new Xc},function(a){a.reset()},100);Wc.prototype.add=function(a,b){var c=Yc.get();c.set(a,b);this.$c?this.$c.next=c:(w(!this.eb),this.eb=c);this.$c=c};Wc.prototype.remove=function(){var a=null;this.eb&&(a=this.eb,this.eb=this.eb.next,this.eb||(this.$c=null),a.next=null);return a};var Xc=function(){this.next=this.scope=this.nd=null};Xc.prototype.set=function(a,b){this.nd=a;this.scope=b;this.next=null};
Xc.prototype.reset=function(){this.next=this.scope=this.nd=null};var cd=function(a,b){Zc||$c();ad||(Zc(),ad=!0);bd.add(a,b)},Zc,$c=function(){if(-1!=String(k.Promise).indexOf("[native code]")){var a=k.Promise.resolve(void 0);Zc=function(){a.then(dd)}}else Zc=function(){var a=dd;!p(k.setImmediate)||k.Window&&k.Window.prototype&&!y("Edge")&&k.Window.prototype.setImmediate==k.setImmediate?(Uc||(Uc=Vc()),Uc(a)):k.setImmediate(a)}},ad=!1,bd=new Wc,dd=function(){for(var a;a=bd.remove();){try{a.nd.call(a.scope)}catch(b){Tc(b)}Yc.put(a)}ad=!1};var ed=function(a){return q(a)?a.constructor.displayName||a.constructor.name||Object.prototype.toString.call(a):void 0===a?"undefined":null===a?"null":typeof a},fd=function(a){return(a=a&&a.ownerDocument)&&(a.defaultView||a.parentWindow)||window};var gd=!z||9<=Number(Db);!ub&&!z||z&&9<=Number(Db)||ub&&A("1.9.1");z&&A("9");var id=function(){this.wa="";this.Ye=hd};id.prototype.mb=!0;id.prototype.kb=function(){return this.wa};id.prototype.toString=function(){return"SafeHtml{"+this.wa+"}"};var jd=function(a){if(a instanceof id&&a.constructor===id&&a.Ye===hd)return a.wa;Ba("expected object of type SafeHtml, got '"+a+"' of type "+fa(a));return"type_error:SafeHtml"},hd={};id.prototype.If=function(a){this.wa=a;return this};var kd=function(a,b){var c=fd(a);"undefined"!=typeof c.HTMLScriptElement&&"undefined"!=typeof c.Element&&w(a&&(a instanceof c.HTMLScriptElement||!(a instanceof c.Element)),"Argument is not a HTMLScriptElement (or a non-Element mock); got: %s",ed(a));a.src=La(b)};var ld=function(a){var b=document;return m(a)?b.getElementById(a):a},nd=function(a,b){fb(b,function(b,d){b&&b.mb&&(b=b.kb());"style"==d?a.style.cssText=b:"class"==d?a.className=b:"for"==d?a.htmlFor=b:md.hasOwnProperty(d)?a.setAttribute(md[d],b):0==d.lastIndexOf("aria-",0)||0==d.lastIndexOf("data-",0)?a.setAttribute(d,b):a[d]=b})},md={cellpadding:"cellPadding",cellspacing:"cellSpacing",colspan:"colSpan",frameborder:"frameBorder",height:"height",maxlength:"maxLength",nonce:"nonce",role:"role",rowspan:"rowSpan",
type:"type",usemap:"useMap",valign:"vAlign",width:"width"},pd=function(a,b,c){var d=arguments,e=document,f=String(d[0]),g=d[1];if(!gd&&g&&(g.name||g.type)){f=["<",f];g.name&&f.push(' name="',xa(g.name),'"');if(g.type){f.push(' type="',xa(g.type),'"');var l={};nb(l,g);delete l.type;g=l}f.push(">");f=f.join("")}f=e.createElement(f);g&&(m(g)?f.className=g:ia(g)?f.className=g.join(" "):nd(f,g));2<d.length&&od(e,f,d);return f},od=function(a,b,c){function d(c){c&&b.appendChild(m(c)?a.createTextNode(c):
c)}for(var e=2;e<c.length;e++){var f=c[e];!ja(f)||q(f)&&0<f.nodeType?d(f):x(qd(f)?ab(f):f,d)}},qd=function(a){if(a&&"number"==typeof a.length){if(q(a))return"function"==typeof a.item||"string"==typeof a.item;if(p(a))return"function"==typeof a.item}return!1};var rd=function(a){a.prototype.then=a.prototype.then;a.prototype.$goog_Thenable=!0},sd=function(a){if(!a)return!1;try{return!!a.$goog_Thenable}catch(b){return!1}};var D=function(a,b){this.Z=0;this.ya=void 0;this.hb=this.ta=this.w=null;this.tc=this.md=!1;if(a!=ea)try{var c=this;a.call(b,function(a){td(c,2,a)},function(a){if(!(a instanceof ud))try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(e){}td(c,3,a)})}catch(d){td(this,3,d)}},vd=function(){this.next=this.context=this.pb=this.Sa=this.child=null;this.Db=!1};vd.prototype.reset=function(){this.context=this.pb=this.Sa=this.child=null;this.Db=!1};
var wd=new Sc(function(){return new vd},function(a){a.reset()},100),xd=function(a,b,c){var d=wd.get();d.Sa=a;d.pb=b;d.context=c;return d},E=function(a){if(a instanceof D)return a;var b=new D(ea);td(b,2,a);return b},F=function(a){return new D(function(b,c){c(a)})},zd=function(a,b,c){yd(a,b,c,null)||cd(ma(b,a))},Ad=function(a){return new D(function(b,c){var d=a.length,e=[];if(d)for(var f=function(a,c){d--;e[a]=c;0==d&&b(e)},g=function(a){c(a)},l=0,n;l<a.length;l++)n=a[l],zd(n,ma(f,l),g);else b(e)})},
Bd=function(a){return new D(function(b){var c=a.length,d=[];if(c)for(var e=function(a,e,f){c--;d[a]=e?{uf:!0,value:f}:{uf:!1,reason:f};0==c&&b(d)},f=0,g;f<a.length;f++)g=a[f],zd(g,ma(e,f,!0),ma(e,f,!1));else b(d)})};D.prototype.then=function(a,b,c){null!=a&&Ea(a,"opt_onFulfilled should be a function.");null!=b&&Ea(b,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");return Cd(this,p(a)?a:null,p(b)?b:null,c)};rd(D);
var Ed=function(a,b){b=xd(b,b,void 0);b.Db=!0;Dd(a,b);return a};D.prototype.f=function(a,b){return Cd(this,null,a,b)};D.prototype.cancel=function(a){0==this.Z&&cd(function(){var b=new ud(a);Fd(this,b)},this)};
var Fd=function(a,b){if(0==a.Z)if(a.w){var c=a.w;if(c.ta){for(var d=0,e=null,f=null,g=c.ta;g&&(g.Db||(d++,g.child==a&&(e=g),!(e&&1<d)));g=g.next)e||(f=g);e&&(0==c.Z&&1==d?Fd(c,b):(f?(d=f,w(c.ta),w(null!=d),d.next==c.hb&&(c.hb=d),d.next=d.next.next):Gd(c),Hd(c,e,3,b)))}a.w=null}else td(a,3,b)},Dd=function(a,b){a.ta||2!=a.Z&&3!=a.Z||Id(a);w(null!=b.Sa);a.hb?a.hb.next=b:a.ta=b;a.hb=b},Cd=function(a,b,c,d){var e=xd(null,null,null);e.child=new D(function(a,g){e.Sa=b?function(c){try{var e=b.call(d,c);a(e)}catch(C){g(C)}}:
a;e.pb=c?function(b){try{var e=c.call(d,b);!ba(e)&&b instanceof ud?g(b):a(e)}catch(C){g(C)}}:g});e.child.w=a;Dd(a,e);return e.child};D.prototype.qg=function(a){w(1==this.Z);this.Z=0;td(this,2,a)};D.prototype.rg=function(a){w(1==this.Z);this.Z=0;td(this,3,a)};
var td=function(a,b,c){0==a.Z&&(a===c&&(b=3,c=new TypeError("Promise cannot resolve to itself")),a.Z=1,yd(c,a.qg,a.rg,a)||(a.ya=c,a.Z=b,a.w=null,Id(a),3!=b||c instanceof ud||Jd(a,c)))},yd=function(a,b,c,d){if(a instanceof D)return null!=b&&Ea(b,"opt_onFulfilled should be a function."),null!=c&&Ea(c,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),Dd(a,xd(b||ea,c||null,d)),!0;if(sd(a))return a.then(b,c,d),!0;if(q(a))try{var e=a.then;if(p(e))return Kd(a,
e,b,c,d),!0}catch(f){return c.call(d,f),!0}return!1},Kd=function(a,b,c,d,e){var f=!1,g=function(a){f||(f=!0,c.call(e,a))},l=function(a){f||(f=!0,d.call(e,a))};try{b.call(a,g,l)}catch(n){l(n)}},Id=function(a){a.md||(a.md=!0,cd(a.qf,a))},Gd=function(a){var b=null;a.ta&&(b=a.ta,a.ta=b.next,b.next=null);a.ta||(a.hb=null);null!=b&&w(null!=b.Sa);return b};D.prototype.qf=function(){for(var a;a=Gd(this);)Hd(this,a,this.Z,this.ya);this.md=!1};
var Hd=function(a,b,c,d){if(3==c&&b.pb&&!b.Db)for(;a&&a.tc;a=a.w)a.tc=!1;if(b.child)b.child.w=null,Ld(b,c,d);else try{b.Db?b.Sa.call(b.context):Ld(b,c,d)}catch(e){Md.call(null,e)}wd.put(b)},Ld=function(a,b,c){2==b?a.Sa.call(a.context,c):a.pb&&a.pb.call(a.context,c)},Jd=function(a,b){a.tc=!0;cd(function(){a.tc&&Md.call(null,b)})},Md=Tc,ud=function(a){u.call(this,a)};t(ud,u);ud.prototype.name="cancel";
var Nd=function(a,b){this.Oc=[];this.De=a;this.je=b||null;this.Lb=this.jb=!1;this.ya=void 0;this.Ud=this.$d=this.dd=!1;this.Wc=0;this.w=null;this.ed=0};Nd.prototype.cancel=function(a){if(this.jb)this.ya instanceof Nd&&this.ya.cancel();else{if(this.w){var b=this.w;delete this.w;a?b.cancel(a):(b.ed--,0>=b.ed&&b.cancel())}this.De?this.De.call(this.je,this):this.Ud=!0;this.jb||Od(this,new Pd)}};Nd.prototype.he=function(a,b){this.dd=!1;Qd(this,a,b)};
var Qd=function(a,b,c){a.jb=!0;a.ya=c;a.Lb=!b;Rd(a)},Td=function(a){if(a.jb){if(!a.Ud)throw new Sd;a.Ud=!1}};Nd.prototype.callback=function(a){Td(this);Ud(a);Qd(this,!0,a)};var Od=function(a,b){Td(a);Ud(b);Qd(a,!1,b)},Ud=function(a){w(!(a instanceof Nd),"An execution sequence may not be initiated with a blocking Deferred.")},Wd=function(a,b){Vd(a,null,b,void 0)},Vd=function(a,b,c,d){w(!a.$d,"Blocking Deferreds can not be re-used");a.Oc.push([b,c,d]);a.jb&&Rd(a)};
Nd.prototype.then=function(a,b,c){var d,e,f=new D(function(a,b){d=a;e=b});Vd(this,d,function(a){a instanceof Pd?f.cancel():e(a)});return f.then(a,b,c)};rd(Nd);
var Xd=function(a){return Ta(a.Oc,function(a){return p(a[1])})},Rd=function(a){if(a.Wc&&a.jb&&Xd(a)){var b=a.Wc,c=Yd[b];c&&(k.clearTimeout(c.Mb),delete Yd[b]);a.Wc=0}a.w&&(a.w.ed--,delete a.w);b=a.ya;for(var d=c=!1;a.Oc.length&&!a.dd;){var e=a.Oc.shift(),f=e[0],g=e[1];e=e[2];if(f=a.Lb?g:f)try{var l=f.call(e||a.je,b);ba(l)&&(a.Lb=a.Lb&&(l==b||l instanceof Error),a.ya=b=l);if(sd(b)||"function"===typeof k.Promise&&b instanceof k.Promise)d=!0,a.dd=!0}catch(n){b=n,a.Lb=!0,Xd(a)||(c=!0)}}a.ya=b;d&&(l=r(a.he,
a,!0),d=r(a.he,a,!1),b instanceof Nd?(Vd(b,l,d),b.$d=!0):b.then(l,d));c&&(b=new Zd(b),Yd[b.Mb]=b,a.Wc=b.Mb)},Sd=function(){u.call(this)};t(Sd,u);Sd.prototype.message="Deferred has already fired";Sd.prototype.name="AlreadyCalledError";var Pd=function(){u.call(this)};t(Pd,u);Pd.prototype.message="Deferred was canceled";Pd.prototype.name="CanceledError";var Zd=function(a){this.Mb=k.setTimeout(r(this.pg,this),0);this.$=a};
Zd.prototype.pg=function(){w(Yd[this.Mb],"Cannot throw an error that is not scheduled.");delete Yd[this.Mb];throw this.$;};var Yd={};var de=function(a){var b={},c=b.document||document,d=La(a),e=document.createElement("SCRIPT"),f={Ke:e,gc:void 0},g=new Nd($d,f),l=null,n=null!=b.timeout?b.timeout:5E3;0<n&&(l=window.setTimeout(function(){ae(e,!0);Od(g,new be(1,"Timeout reached for loading script "+d))},n),f.gc=l);e.onload=e.onreadystatechange=function(){e.readyState&&"loaded"!=e.readyState&&"complete"!=e.readyState||(ae(e,b.Dg||!1,l),g.callback(null))};e.onerror=function(){ae(e,!0,l);Od(g,new be(0,"Error while loading script "+d))};
f=b.attributes||{};nb(f,{type:"text/javascript",charset:"UTF-8"});nd(e,f);kd(e,a);ce(c).appendChild(e);return g},ce=function(a){var b;return(b=(a||document).getElementsByTagName("HEAD"))&&0!=b.length?b[0]:a.documentElement},$d=function(){if(this&&this.Ke){var a=this.Ke;a&&"SCRIPT"==a.tagName&&ae(a,!0,this.gc)}},ae=function(a,b,c){null!=c&&k.clearTimeout(c);a.onload=ea;a.onerror=ea;a.onreadystatechange=ea;b&&window.setTimeout(function(){a&&a.parentNode&&a.parentNode.removeChild(a)},0)},be=function(a,
b){var c="Jsloader error (code #"+a+")";b&&(c+=": "+b);u.call(this,c);this.code=a};t(be,u);var ee=function(a,b,c,d,e){this.reset(a,b,c,d,e)};ee.prototype.le=null;var fe=0;ee.prototype.reset=function(a,b,c,d,e){"number"==typeof e||fe++;d||na();this.Rb=a;this.Rf=b;delete this.le};ee.prototype.Me=function(a){this.Rb=a};var ge=function(a){this.Be=a;this.re=this.gd=this.Rb=this.w=null},he=function(a,b){this.name=a;this.value=b};he.prototype.toString=function(){return this.name};var ie=new he("SEVERE",1E3),je=new he("INFO",800),ke=new he("CONFIG",700),le=new he("FINE",500);ge.prototype.getName=function(){return this.Be};ge.prototype.getParent=function(){return this.w};ge.prototype.Me=function(a){this.Rb=a};var me=function(a){if(a.Rb)return a.Rb;if(a.w)return me(a.w);Ba("Root logger has no level set.");return null};
ge.prototype.log=function(a,b,c){if(a.value>=me(this).value)for(p(b)&&(b=b()),a=new ee(a,String(b),this.Be),c&&(a.le=c),c="log:"+a.Rf,(b=k.console)&&b.timeStamp&&b.timeStamp(c),(b=k.msWriteProfilerMark)&&b(c),c=this;c;){var d=c,e=a;if(d.re)for(var f=0;b=d.re[f];f++)b(e);c=c.getParent()}};ge.prototype.info=function(a,b){this.log(je,a,b)};ge.prototype.config=function(a,b){this.log(ke,a,b)};
var ne={},oe=null,pe=function(a){oe||(oe=new ge(""),ne[""]=oe,oe.Me(ke));var b;if(!(b=ne[a])){b=new ge(a);var c=a.lastIndexOf("."),d=a.substr(c+1);c=pe(a.substr(0,c));c.gd||(c.gd={});c.gd[d]=b;b.w=c;ne[a]=b}return b};var G=function(){Ub.call(this);this.ea=new cc(this);this.cf=this;this.Ed=null};t(G,Ub);G.prototype[Zb]=!0;h=G.prototype;h.addEventListener=function(a,b,c,d){kc(this,a,b,c,d)};h.removeEventListener=function(a,b,c,d){sc(this,a,b,c,d)};
h.dispatchEvent=function(a){qe(this);var b=this.Ed;if(b){var c=[];for(var d=1;b;b=b.Ed)c.push(b),w(1E3>++d,"infinite loop")}b=this.cf;d=a.type||a;if(m(a))a=new B(a,b);else if(a instanceof B)a.target=a.target||b;else{var e=a;a=new B(d,b);nb(a,e)}e=!0;if(c)for(var f=c.length-1;!a.Ua&&0<=f;f--){var g=a.currentTarget=c[f];e=re(g,d,!0,a)&&e}a.Ua||(g=a.currentTarget=b,e=re(g,d,!0,a)&&e,a.Ua||(e=re(g,d,!1,a)&&e));if(c)for(f=0;!a.Ua&&f<c.length;f++)g=a.currentTarget=c[f],e=re(g,d,!1,a)&&e;return e};
h.ib=function(){G.Sc.ib.call(this);if(this.ea){var a=this.ea,b=0,c;for(c in a.J){for(var d=a.J[c],e=0;e<d.length;e++)++b,bc(d[e]);delete a.J[c];a.hc--}}this.Ed=null};h.listen=function(a,b,c,d){qe(this);return this.ea.add(String(a),b,!1,c,d)};
var rc=function(a,b,c,d,e){a.ea.add(String(b),c,!0,d,e)},re=function(a,b,c,d){b=a.ea.J[String(b)];if(!b)return!0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var g=b[f];if(g&&!g.yb&&g.capture==c){var l=g.listener,n=g.uc||g.src;g.nc&&fc(a.ea,g);e=!1!==l.call(n,d)&&e}}return e&&0!=d.Je};G.prototype.od=function(a,b,c,d){return this.ea.od(String(a),b,c,d)};G.prototype.hasListener=function(a,b){return this.ea.hasListener(ba(a)?String(a):void 0,b)};var qe=function(a){w(a.ea,"Event target is not initialized. Did you call the superclass (goog.events.EventTarget) constructor?")};var se="StopIteration"in k?k.StopIteration:{message:"StopIteration",stack:""},te=function(){};te.prototype.next=function(){throw se;};te.prototype.bf=function(){return this};var H=function(a,b){a&&a.log(le,b,void 0)};var ue=function(a,b){this.ia={};this.A=[];this.cb=this.s=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1])}else a&&this.addAll(a)};h=ue.prototype;h.ga=function(){ve(this);for(var a=[],b=0;b<this.A.length;b++)a.push(this.ia[this.A[b]]);return a};h.ua=function(){ve(this);return this.A.concat()};h.Fb=function(a){return we(this.ia,a)};h.clear=function(){this.ia={};this.cb=this.s=this.A.length=0};
h.remove=function(a){return we(this.ia,a)?(delete this.ia[a],this.s--,this.cb++,this.A.length>2*this.s&&ve(this),!0):!1};var ve=function(a){var b,c;if(a.s!=a.A.length){for(b=c=0;c<a.A.length;){var d=a.A[c];we(a.ia,d)&&(a.A[b++]=d);c++}a.A.length=b}if(a.s!=a.A.length){var e={};for(b=c=0;c<a.A.length;)d=a.A[c],we(e,d)||(a.A[b++]=d,e[d]=1),c++;a.A.length=b}};h=ue.prototype;h.get=function(a,b){return we(this.ia,a)?this.ia[a]:b};
h.set=function(a,b){we(this.ia,a)||(this.s++,this.A.push(a),this.cb++);this.ia[a]=b};h.addAll=function(a){if(a instanceof ue){var b=a.ua();a=a.ga()}else b=ib(a),a=hb(a);for(var c=0;c<b.length;c++)this.set(b[c],a[c])};h.forEach=function(a,b){for(var c=this.ua(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this)}};h.clone=function(){return new ue(this)};
h.bf=function(a){ve(this);var b=0,c=this.cb,d=this,e=new te;e.next=function(){if(c!=d.cb)throw Error("The map has changed since the iterator was created");if(b>=d.A.length)throw se;var e=d.A[b++];return a?e:d.ia[e]};return e};var we=function(a,b){return Object.prototype.hasOwnProperty.call(a,b)};var xe=function(a){if(a.ga&&"function"==typeof a.ga)return a.ga();if(m(a))return a.split("");if(ja(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}return hb(a)},ye=function(a){if(a.ua&&"function"==typeof a.ua)return a.ua();if(!a.ga||"function"!=typeof a.ga){if(ja(a)||m(a)){var b=[];a=a.length;for(var c=0;c<a;c++)b.push(c);return b}return ib(a)}},ze=function(a,b,c){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,c);else if(ja(a)||m(a))x(a,b,c);else for(var d=ye(a),e=xe(a),f=e.length,
g=0;g<f;g++)b.call(c,e[g],d&&d[g],a)};var Ae=function(a,b,c){if(p(a))c&&(a=r(a,c));else if(a&&"function"==typeof a.handleEvent)a=r(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:k.setTimeout(a,b||0)},Be=function(a){var b=null;return(new D(function(c,d){b=Ae(function(){c(void 0)},a);-1==b&&d(Error("Failed to schedule timer."))})).f(function(a){k.clearTimeout(b);throw a;})};var Ce=/^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([^/#?]*?)(?::([0-9]+))?(?=[/#?]|$))?([^?#]+)?(?:\?([^#]*))?(?:#([\s\S]*))?$/,De=function(a,b){if(a){a=a.split("&");for(var c=0;c<a.length;c++){var d=a[c].indexOf("="),e=null;if(0<=d){var f=a[c].substring(0,d);e=a[c].substring(d+1)}else f=a[c];b(f,e?decodeURIComponent(e.replace(/\+/g," ")):"")}}};var I=function(a){G.call(this);this.headers=new ue;this.bd=a||null;this.Aa=!1;this.ad=this.b=null;this.Qb=this.Ae=this.Dc="";this.Oa=this.td=this.yc=this.ld=!1;this.zb=0;this.Tc=null;this.Nc="";this.Xc=this.Yf=this.Xe=!1};t(I,G);var Ee=I.prototype,Fe=pe("goog.net.XhrIo");Ee.O=Fe;var Ge=/^https?$/i,He=["POST","PUT"];
I.prototype.send=function(a,b,c,d){if(this.b)throw Error("[goog.net.XhrIo] Object is active with another request="+this.Dc+"; newUri="+a);b=b?b.toUpperCase():"GET";this.Dc=a;this.Qb="";this.Ae=b;this.ld=!1;this.Aa=!0;this.b=this.bd?this.bd.pc():Mc.pc();this.ad=this.bd?Lc(this.bd):Lc(Mc);this.b.onreadystatechange=r(this.Ge,this);this.Yf&&"onprogress"in this.b&&(this.b.onprogress=r(function(a){this.Fe(a,!0)},this),this.b.upload&&(this.b.upload.onprogress=r(this.Fe,this)));try{H(this.O,Ie(this,"Opening Xhr")),
this.td=!0,this.b.open(b,String(a),!0),this.td=!1}catch(f){H(this.O,Ie(this,"Error opening Xhr: "+f.message));this.$(5,f);return}a=c||"";var e=this.headers.clone();d&&ze(d,function(a,b){e.set(b,a)});d=Va(e.ua());c=k.FormData&&a instanceof k.FormData;!Wa(He,b)||d||c||e.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");e.forEach(function(a,b){this.b.setRequestHeader(b,a)},this);this.Nc&&(this.b.responseType=this.Nc);"withCredentials"in this.b&&this.b.withCredentials!==this.Xe&&(this.b.withCredentials=
this.Xe);try{Je(this),0<this.zb&&(this.Xc=Ke(this.b),H(this.O,Ie(this,"Will abort after "+this.zb+"ms if incomplete, xhr2 "+this.Xc)),this.Xc?(this.b.timeout=this.zb,this.b.ontimeout=r(this.gc,this)):this.Tc=Ae(this.gc,this.zb,this)),H(this.O,Ie(this,"Sending request")),this.yc=!0,this.b.send(a),this.yc=!1}catch(f){H(this.O,Ie(this,"Send error: "+f.message)),this.$(5,f)}};var Ke=function(a){return z&&A(9)&&da(a.timeout)&&ba(a.ontimeout)},Ua=function(a){return"content-type"==a.toLowerCase()};
I.prototype.gc=function(){"undefined"!=typeof aa&&this.b&&(this.Qb="Timed out after "+this.zb+"ms, aborting",H(this.O,Ie(this,this.Qb)),this.dispatchEvent("timeout"),this.abort(8))};I.prototype.$=function(a,b){this.Aa=!1;this.b&&(this.Oa=!0,this.b.abort(),this.Oa=!1);this.Qb=b;Le(this);Me(this)};var Le=function(a){a.ld||(a.ld=!0,a.dispatchEvent("complete"),a.dispatchEvent("error"))};
I.prototype.abort=function(){this.b&&this.Aa&&(H(this.O,Ie(this,"Aborting")),this.Aa=!1,this.Oa=!0,this.b.abort(),this.Oa=!1,this.dispatchEvent("complete"),this.dispatchEvent("abort"),Me(this))};I.prototype.ib=function(){this.b&&(this.Aa&&(this.Aa=!1,this.Oa=!0,this.b.abort(),this.Oa=!1),Me(this,!0));I.Sc.ib.call(this)};I.prototype.Ge=function(){this.isDisposed()||(this.td||this.yc||this.Oa?Ne(this):this.Uf())};I.prototype.Uf=function(){Ne(this)};
var Ne=function(a){if(a.Aa&&"undefined"!=typeof aa)if(a.ad[1]&&4==Oe(a)&&2==Pe(a))H(a.O,Ie(a,"Local request error detected and ignored"));else if(a.yc&&4==Oe(a))Ae(a.Ge,0,a);else if(a.dispatchEvent("readystatechange"),4==Oe(a)){H(a.O,Ie(a,"Request complete"));a.Aa=!1;try{var b=Pe(a);a:switch(b){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var c=!0;break a;default:c=!1}var d;if(!(d=c)){var e;if(e=0===b){var f=String(a.Dc).match(Ce)[1]||null;if(!f&&k.self&&k.self.location){var g=
k.self.location.protocol;f=g.substr(0,g.length-1)}e=!Ge.test(f?f.toLowerCase():"")}d=e}if(d)a.dispatchEvent("complete"),a.dispatchEvent("success");else{try{var l=2<Oe(a)?a.b.statusText:""}catch(n){H(a.O,"Can not get status: "+n.message),l=""}a.Qb=l+" ["+Pe(a)+"]";Le(a)}}finally{Me(a)}}};I.prototype.Fe=function(a,b){w("progress"===a.type,"goog.net.EventType.PROGRESS is of the same type as raw XHR progress.");this.dispatchEvent(Qe(a,"progress"));this.dispatchEvent(Qe(a,b?"downloadprogress":"uploadprogress"))};
var Qe=function(a,b){return{type:b,lengthComputable:a.lengthComputable,loaded:a.loaded,total:a.total}},Me=function(a,b){if(a.b){Je(a);var c=a.b,d=a.ad[0]?ea:null;a.b=null;a.ad=null;b||a.dispatchEvent("ready");try{c.onreadystatechange=d}catch(e){(a=a.O)&&a.log(ie,"Problem encountered resetting onreadystatechange: "+e.message,void 0)}}},Je=function(a){a.b&&a.Xc&&(a.b.ontimeout=null);da(a.Tc)&&(k.clearTimeout(a.Tc),a.Tc=null)},Oe=function(a){return a.b?a.b.readyState:0},Pe=function(a){try{return 2<Oe(a)?
a.b.status:-1}catch(b){return-1}},Re=function(a){try{return a.b?a.b.responseText:""}catch(b){return H(a.O,"Can not get responseText: "+b.message),""}};
I.prototype.getResponse=function(){try{if(!this.b)return null;if("response"in this.b)return this.b.response;switch(this.Nc){case "":case "text":return this.b.responseText;case "arraybuffer":if("mozResponseArrayBuffer"in this.b)return this.b.mozResponseArrayBuffer}var a=this.O;a&&a.log(ie,"Response type "+this.Nc+" is not supported on this browser",void 0);return null}catch(b){return H(this.O,"Can not get response: "+b.message),null}};
I.prototype.getResponseHeader=function(a){if(this.b&&4==Oe(this))return a=this.b.getResponseHeader(a),null===a?void 0:a};I.prototype.getAllResponseHeaders=function(){return this.b&&4==Oe(this)?this.b.getAllResponseHeaders():""};var Ie=function(a,b){return b+" ["+a.Ae+" "+a.Dc+" "+Pe(a)+"]"};var Se=function(a,b){this.oa=this.ab=this.pa="";this.rb=null;this.Na=this.Da="";this.ba=this.Mf=!1;if(a instanceof Se){this.ba=ba(b)?b:a.ba;Te(this,a.pa);var c=a.ab;J(this);this.ab=c;Ue(this,a.oa);Ve(this,a.rb);We(this,a.Da);Xe(this,a.ca.clone());a=a.Na;J(this);this.Na=a}else a&&(c=String(a).match(Ce))?(this.ba=!!b,Te(this,c[1]||"",!0),a=c[2]||"",J(this),this.ab=Ye(a),Ue(this,c[3]||"",!0),Ve(this,c[4]),We(this,c[5]||"",!0),Xe(this,c[6]||"",!0),a=c[7]||"",J(this),this.Na=Ye(a)):(this.ba=!!b,this.ca=
new Ze(null,0,this.ba))};Se.prototype.toString=function(){var a=[],b=this.pa;b&&a.push($e(b,af,!0),":");var c=this.oa;if(c||"file"==b)a.push("//"),(b=this.ab)&&a.push($e(b,af,!0),"@"),a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.rb,null!=c&&a.push(":",String(c));if(c=this.Da)this.oa&&"/"!=c.charAt(0)&&a.push("/"),a.push($e(c,"/"==c.charAt(0)?bf:cf,!0));(c=this.ca.toString())&&a.push("?",c);(c=this.Na)&&a.push("#",$e(c,df));return a.join("")};
Se.prototype.resolve=function(a){var b=this.clone(),c=!!a.pa;c?Te(b,a.pa):c=!!a.ab;if(c){var d=a.ab;J(b);b.ab=d}else c=!!a.oa;c?Ue(b,a.oa):c=null!=a.rb;d=a.Da;if(c)Ve(b,a.rb);else if(c=!!a.Da){if("/"!=d.charAt(0))if(this.oa&&!this.Da)d="/"+d;else{var e=b.Da.lastIndexOf("/");-1!=e&&(d=b.Da.substr(0,e+1)+d)}e=d;if(".."==e||"."==e)d="";else if(v(e,"./")||v(e,"/.")){d=0==e.lastIndexOf("/",0);e=e.split("/");for(var f=[],g=0;g<e.length;){var l=e[g++];"."==l?d&&g==e.length&&f.push(""):".."==l?((1<f.length||
1==f.length&&""!=f[0])&&f.pop(),d&&g==e.length&&f.push("")):(f.push(l),d=!0)}d=f.join("/")}else d=e}c?We(b,d):c=""!==a.ca.toString();c?Xe(b,a.ca.clone()):c=!!a.Na;c&&(a=a.Na,J(b),b.Na=a);return b};Se.prototype.clone=function(){return new Se(this)};
var Te=function(a,b,c){J(a);a.pa=c?Ye(b,!0):b;a.pa&&(a.pa=a.pa.replace(/:$/,""))},Ue=function(a,b,c){J(a);a.oa=c?Ye(b,!0):b},Ve=function(a,b){J(a);if(b){b=Number(b);if(isNaN(b)||0>b)throw Error("Bad port number "+b);a.rb=b}else a.rb=null},We=function(a,b,c){J(a);a.Da=c?Ye(b,!0):b},Xe=function(a,b,c){J(a);b instanceof Ze?(a.ca=b,a.ca.Rd(a.ba)):(c||(b=$e(b,ef)),a.ca=new Ze(b,0,a.ba))},K=function(a,b,c){J(a);a.ca.set(b,c)},ff=function(a,b){return a.ca.get(b)};
Se.prototype.removeParameter=function(a){J(this);this.ca.remove(a);return this};var J=function(a){if(a.Mf)throw Error("Tried to modify a read-only Uri");};Se.prototype.Rd=function(a){this.ba=a;this.ca&&this.ca.Rd(a);return this};
var gf=function(a){return a instanceof Se?a.clone():new Se(a,void 0)},hf=function(a,b){var c=new Se(null,void 0);Te(c,"https");a&&Ue(c,a);b&&We(c,b);return c},Ye=function(a,b){return a?b?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""},$e=function(a,b,c){return m(a)?(a=encodeURI(a).replace(b,jf),c&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null},jf=function(a){a=a.charCodeAt(0);return"%"+(a>>4&15).toString(16)+(a&15).toString(16)},af=/[#\/\?@]/g,cf=/[\#\?:]/g,bf=/[\#\?]/g,ef=/[\#\?@]/g,
df=/#/g,Ze=function(a,b,c){this.s=this.m=null;this.T=a||null;this.ba=!!c},kf=function(a){a.m||(a.m=new ue,a.s=0,a.T&&De(a.T,function(b,c){a.add(decodeURIComponent(b.replace(/\+/g," ")),c)}))},mf=function(a){var b=ye(a);if("undefined"==typeof b)throw Error("Keys are undefined");var c=new Ze(null,0,void 0);a=xe(a);for(var d=0;d<b.length;d++){var e=b[d],f=a[d];ia(f)?lf(c,e,f):c.add(e,f)}return c};h=Ze.prototype;
h.add=function(a,b){kf(this);this.T=null;a=this.aa(a);var c=this.m.get(a);c||this.m.set(a,c=[]);c.push(b);this.s=Ca(this.s)+1;return this};h.remove=function(a){kf(this);a=this.aa(a);return this.m.Fb(a)?(this.T=null,this.s=Ca(this.s)-this.m.get(a).length,this.m.remove(a)):!1};h.clear=function(){this.m=this.T=null;this.s=0};h.Fb=function(a){kf(this);a=this.aa(a);return this.m.Fb(a)};h.forEach=function(a,b){kf(this);this.m.forEach(function(c,d){x(c,function(c){a.call(b,c,d,this)},this)},this)};
h.ua=function(){kf(this);for(var a=this.m.ga(),b=this.m.ua(),c=[],d=0;d<b.length;d++)for(var e=a[d],f=0;f<e.length;f++)c.push(b[d]);return c};h.ga=function(a){kf(this);var b=[];if(m(a))this.Fb(a)&&(b=$a(b,this.m.get(this.aa(a))));else{a=this.m.ga();for(var c=0;c<a.length;c++)b=$a(b,a[c])}return b};h.set=function(a,b){kf(this);this.T=null;a=this.aa(a);this.Fb(a)&&(this.s=Ca(this.s)-this.m.get(a).length);this.m.set(a,[b]);this.s=Ca(this.s)+1;return this};
h.get=function(a,b){a=a?this.ga(a):[];return 0<a.length?String(a[0]):b};var lf=function(a,b,c){a.remove(b);0<c.length&&(a.T=null,a.m.set(a.aa(b),ab(c)),a.s=Ca(a.s)+c.length)};h=Ze.prototype;h.toString=function(){if(this.T)return this.T;if(!this.m)return"";for(var a=[],b=this.m.ua(),c=0;c<b.length;c++){var d=b[c],e=encodeURIComponent(String(d));d=this.ga(d);for(var f=0;f<d.length;f++){var g=e;""!==d[f]&&(g+="="+encodeURIComponent(String(d[f])));a.push(g)}}return this.T=a.join("&")};
h.clone=function(){var a=new Ze;a.T=this.T;this.m&&(a.m=this.m.clone(),a.s=this.s);return a};h.aa=function(a){a=String(a);this.ba&&(a=a.toLowerCase());return a};h.Rd=function(a){a&&!this.ba&&(kf(this),this.T=null,this.m.forEach(function(a,c){var b=c.toLowerCase();c!=b&&(this.remove(c),lf(this,b,a))},this));this.ba=a};h.extend=function(a){for(var b=0;b<arguments.length;b++)ze(arguments[b],function(a,b){this.add(b,a)},this)};var nf=function(){var a=L();return z&&!!Db&&11==Db||/Edge\/\d+/.test(a)},of=function(){return k.window&&k.window.location.href||""},pf=function(a,b){b=b||k.window;var c="about:blank";a&&(c=Ac(Dc(a)));b.location.href=c},qf=function(a,b){var c=[],d;for(d in a)d in b?typeof a[d]!=typeof b[d]?c.push(d):ia(a[d])?kb(a[d],b[d])||c.push(d):"object"==typeof a[d]&&null!=a[d]&&null!=b[d]?0<qf(a[d],b[d]).length&&c.push(d):a[d]!==b[d]&&c.push(d):c.push(d);for(d in b)d in a||c.push(d);return c},sf=function(){var a=
L();a="Chrome"!=rf(a)?null:(a=a.match(/\sChrome\/(\d+)/i))&&2==a.length?parseInt(a[1],10):null;return a&&30>a?!1:!z||!Db||9<Db},tf=function(a){a=(a||L()).toLowerCase();return a.match(/android/)||a.match(/webos/)||a.match(/iphone|ipad|ipod/)||a.match(/blackberry/)||a.match(/windows phone/)||a.match(/iemobile/)?!0:!1},uf=function(a){a=a||k.window;try{a.close()}catch(b){}},vf=function(a,b,c){var d=Math.floor(1E9*Math.random()).toString();b=b||500;c=c||600;var e=(window.screen.availHeight-c)/2,f=(window.screen.availWidth-
b)/2;b={width:b,height:c,top:0<e?e:0,left:0<f?f:0,location:!0,resizable:!0,statusbar:!0,toolbar:!1};c=L().toLowerCase();d&&(b.target=d,v(c,"crios/")&&(b.target="_blank"));"Firefox"==rf(L())&&(a=a||"http://localhost",b.scrollbars=!0);c=a||"";(d=b)||(d={});a=window;b=c instanceof zc?c:Dc("undefined"!=typeof c.href?c.href:String(c));c=d.target||c.target;e=[];for(g in d)switch(g){case "width":case "height":case "top":case "left":e.push(g+"="+d[g]);break;case "target":case "noreferrer":break;default:e.push(g+
"="+(d[g]?1:0))}var g=e.join(",");(y("iPhone")&&!y("iPod")&&!y("iPad")||y("iPad")||y("iPod"))&&a.navigator&&a.navigator.standalone&&c&&"_self"!=c?(g=a.document.createElement("A"),e=fd(g),"undefined"!=typeof e.HTMLAnchorElement&&"undefined"!=typeof e.Location&&"undefined"!=typeof e.Element&&w(g&&(g instanceof e.HTMLAnchorElement||!(g instanceof e.Location||g instanceof e.Element)),"Argument is not a HTMLAnchorElement (or a non-Element mock); got: %s",ed(g)),b instanceof zc||b instanceof zc||(b=b.mb?
b.kb():String(b),w(Bc.test(b))||(b="about:invalid#zClosurez"),b=Cc(b)),g.href=Ac(b),g.setAttribute("target",c),d.noreferrer&&g.setAttribute("rel","noreferrer"),d=document.createEvent("MouseEvent"),d.initMouseEvent("click",!0,!0,a,1),g.dispatchEvent(d),g={}):d.noreferrer?(g=a.open("",c,g),d=Ac(b),g&&(tb&&v(d,";")&&(d="'"+d.replace(/'/g,"%27")+"'"),g.opener=null,a=Ia("b/12014412, meta tag with sanitized URL"),d='<META HTTP-EQUIV="refresh" content="0; url='+xa(d)+'">',Da(Ha(a),"must provide justification"),
w(!/^[\s\xa0]*$/.test(Ha(a)),"must provide non-empty justification"),g.document.write(jd((new id).If(d))),g.document.close())):g=a.open(Ac(b),c,g);if(g)try{g.focus()}catch(l){}return g},wf=function(a){return new D(function(b){var c=function(){Be(2E3).then(function(){if(!a||a.closed)b();else return c()})};return c()})},xf=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,yf=function(){var a=null;return(new D(function(b){"complete"==k.document.readyState?b():(a=function(){b()},jc(window,"load",a))})).f(function(b){sc(window,
"load",a);throw b;})},Af=function(){return zf(void 0)?yf().then(function(){return new D(function(a,b){var c=k.document,d=setTimeout(function(){b(Error("Cordova framework is not ready."))},1E3);c.addEventListener("deviceready",function(){clearTimeout(d);a()},!1)})}):F(Error("Cordova must run in an Android or iOS file scheme."))},zf=function(a){a=a||L();return!("file:"!==Bf()||!a.toLowerCase().match(/iphone|ipad|ipod|android/))},Cf=function(){var a=k.window;try{return!(!a||a==a.top)}catch(b){return!1}},
Df=function(){return firebase.INTERNAL.hasOwnProperty("reactNative")?"ReactNative":firebase.INTERNAL.hasOwnProperty("node")?"Node":"Browser"},Ef=function(){var a=Df();return"ReactNative"===a||"Node"===a},rf=function(a){var b=a.toLowerCase();if(v(b,"opera/")||v(b,"opr/")||v(b,"opios/"))return"Opera";if(v(b,"iemobile"))return"IEMobile";if(v(b,"msie")||v(b,"trident/"))return"IE";if(v(b,"edge/"))return"Edge";if(v(b,"firefox/"))return"Firefox";if(v(b,"silk/"))return"Silk";if(v(b,"blackberry"))return"Blackberry";
if(v(b,"webos"))return"Webos";if(!v(b,"safari/")||v(b,"chrome/")||v(b,"crios/")||v(b,"android"))if(!v(b,"chrome/")&&!v(b,"crios/")||v(b,"edge/")){if(v(b,"android"))return"Android";if((a=a.match(/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/))&&2==a.length)return a[1]}else return"Chrome";else return"Safari";return"Other"},Ff=function(a){var b=Df();return("Browser"===b?rf(L()):b)+"/JsCore/"+a},L=function(){return k.navigator&&k.navigator.userAgent||""},M=function(a,b){a=a.split(".");b=b||k;for(var c=0;c<a.length&&
"object"==typeof b&&null!=b;c++)b=b[a[c]];c!=a.length&&(b=void 0);return b},Hf=function(){try{var a=k.localStorage,b=Gf();if(a)return a.setItem(b,"1"),a.removeItem(b),nf()?!!k.indexedDB:!0}catch(c){}return!1},Jf=function(){return(If()||"chrome-extension:"===Bf()||zf())&&!Ef()&&Hf()},If=function(){return"http:"===Bf()||"https:"===Bf()},Bf=function(){return k.location&&k.location.protocol||null},Kf=function(a){a=a||L();return tf(a)||"Firefox"==rf(a)?!1:!0},Lf=function(a){return"undefined"===typeof a?
null:Gc(a)},Mf=function(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&null!==a[c]&&void 0!==a[c]&&(b[c]=a[c]);return b},Nf=function(a){if(null!==a)return JSON.parse(a)},Gf=function(a){return a?a:""+Math.floor(1E9*Math.random()).toString()},Of=function(a){a=a||L();return"Safari"==rf(a)||a.toLowerCase().match(/iphone|ipad|ipod/)?!1:!0},Pf=function(){var a=k.___jsl;if(a&&a.H)for(var b in a.H)if(a.H[b].r=a.H[b].r||[],a.H[b].L=a.H[b].L||[],a.H[b].r=a.H[b].L.concat(),a.CP)for(var c=0;c<a.CP.length;c++)a.CP[c]=
null},Qf=function(){var a=k.navigator;return a&&"boolean"===typeof a.onLine&&(If()||"chrome-extension:"===Bf()||"undefined"!==typeof a.connection)?a.onLine:!0},Rf=function(a,b,c,d){if(a>b)throw Error("Short delay should be less than long delay!");this.lg=a;this.Qf=b;a=c||L();d=d||Df();this.Lf=tf(a)||"ReactNative"===d};Rf.prototype.get=function(){return this.Lf?this.Qf:this.lg};
var Sf=function(){var a=k.document;return a&&"undefined"!==typeof a.visibilityState?"visible"==a.visibilityState:!0},Tf=function(){var a=k.document,b=null;return Sf()||!a?E():(new D(function(c){b=function(){Sf()&&(a.removeEventListener("visibilitychange",b,!1),c())};a.addEventListener("visibilitychange",b,!1)})).f(function(c){a.removeEventListener("visibilitychange",b,!1);throw c;})};var Uf={};var Vf;try{var Wf={};Object.defineProperty(Wf,"abcd",{configurable:!0,enumerable:!0,value:1});Object.defineProperty(Wf,"abcd",{configurable:!0,enumerable:!0,value:2});Vf=2==Wf.abcd}catch(a){Vf=!1}
var N=function(a,b,c){Vf?Object.defineProperty(a,b,{configurable:!0,enumerable:!0,value:c}):a[b]=c},Xf=function(a,b){if(b)for(var c in b)b.hasOwnProperty(c)&&N(a,c,b[c])},Yf=function(a){var b={};Xf(b,a);return b},Zf=function(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&(b[c]=a[c]);return b},$f=function(a,b){if(!b||!b.length)return!0;if(!a)return!1;for(var c=0;c<b.length;c++){var d=a[b[c]];if(void 0===d||null===d||""===d)return!1}return!0},ag=function(a){var b=a;if("object"==typeof a&&null!=a){b=
"length"in a?[]:{};for(var c in a)N(b,c,ag(a[c]))}return b};var bg="oauth_consumer_key oauth_nonce oauth_signature oauth_signature_method oauth_timestamp oauth_token oauth_version".split(" "),cg=["client_id","response_type","scope","redirect_uri","state"],dg={wg:{Cc:"locale",Vb:500,Ub:600,providerId:"facebook.com",Nd:cg},xg:{Cc:null,Vb:500,Ub:620,providerId:"github.com",Nd:cg},yg:{Cc:"hl",Vb:515,Ub:680,providerId:"google.com",Nd:cg},Bg:{Cc:"lang",Vb:485,Ub:705,providerId:"twitter.com",Nd:bg}},eg=function(a){for(var b in dg)if(dg[b].providerId==a)return dg[b];
return null};var O=function(a,b){this.code="auth/"+a;this.message=b||fg[a]||""};t(O,Error);O.prototype.I=function(){return{code:this.code,message:this.message}};O.prototype.toJSON=function(){return this.I()};
var gg=function(a){var b=a&&a.code;return b?new O(b.substring(5),a.message):null},fg={"argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.","captcha-check-failed":"The reCAPTCHA response token provided is either invalid, expired, already used or the domain associated with it does not match the list of whitelisted domains.",
"code-expired":"The SMS code has expired. Please re-send the verification code to try again.","cordova-not-ready":"Cordova framework is not ready.","cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.","requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.",
"dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-already-in-use":"The email address is already in use by another account.","expired-action-code":"The action code has expired. ","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.","internal-error":"An internal error has occurred.","invalid-app-credential":"The phone verification request contains an invalid application verifier. The reCAPTCHA token response is either invalid or expired.",
"invalid-app-id":"The mobile app identifier is not registed for the current project.","invalid-user-token":"The user's credential is no longer valid. The user must sign in again.","invalid-auth-event":"An internal error has occurred.","invalid-verification-code":"The SMS verification code used to create the phone auth credential is invalid. Please resend the verification code sms and be sure use the verification code provided by the user.","invalid-continue-uri":"The continue URL provided in the request is invalid.",
"invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.","invalid-custom-token":"The custom token format is incorrect. Please check the documentation.","invalid-email":"The email address is badly formatted.","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-credential":"The supplied auth credential is malformed or has expired.",
"invalid-persistence-type":"The specified persistence type is invalid. It can only be local, session or none.","invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.",
"invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.","invalid-phone-number":"The format of the phone number provided is incorrect. Please enter the phone number in a format that can be parsed into E.164 format. E.164 phone numbers are written in the format [+][country code][subscriber number including area code].","invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.",
"invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-verification-id":"The verification ID used to create the phone auth credential is invalid.","missing-android-pkg-name":"An Android Package Name must be provided if the Android App is required to be installed.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.",
"missing-app-credential":"The phone verification request is missing an application verifier assertion. A reCAPTCHA response token needs to be provided.","missing-verification-code":"The phone auth credential was created with an empty SMS verification code.","missing-continue-uri":"A continue URL must be provided in the request.","missing-iframe-start":"An internal error has occurred.","missing-ios-bundle-id":"An iOS Bundle ID must be provided if an App Store ID is provided.","missing-phone-number":"To send verification codes, provide a phone number for the recipient.",
"missing-verification-id":"The phone auth credential was created with an empty verification ID.","app-deleted":"This instance of FirebaseApp has been deleted.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":"A network error (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal error has occurred.",
"no-such-provider":"User was not linked to an account with the given provider.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http, https or chrome-extension and web storage must be enabled.',"popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.",
"popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.","quota-exceeded":"The SMS quota for this project has been exceeded.","redirect-cancelled-by-user":"The redirect operation has been cancelled by the user before finalizing.","redirect-operation-pending":"A redirect sign-in operation is already pending.",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.",
"too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","unauthorized-continue-uri":"The domain of the continue URL is not whitelisted.  Please whitelist the domain in the Firebase console.","unsupported-persistence-type":"The current environment does not support the specified persistence type.","user-cancelled":"User did not grant your application the permissions it requested.","user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.",
"user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.","user-signed-out":"","weak-password":"The password must be 6 characters long or more.","web-storage-unsupported":"This browser is not supported or 3rd party cookies and data may be disabled."};var hg=function(a,b,c,d,e){this.la=a;this.U=b||null;this.Ab=c||null;this.Qd=d||null;this.$=e||null;if(this.Ab||this.$){if(this.Ab&&this.$)throw new O("invalid-auth-event");if(this.Ab&&!this.Qd)throw new O("invalid-auth-event");}else throw new O("invalid-auth-event");};hg.prototype.sc=function(){return this.Qd};hg.prototype.getError=function(){return this.$};hg.prototype.I=function(){return{type:this.la,eventId:this.U,urlResponse:this.Ab,sessionId:this.Qd,error:this.$&&this.$.I()}};
var ig=function(a){a=a||{};return a.type?new hg(a.type,a.eventId,a.urlResponse,a.sessionId,a.error&&gg(a.error)):null};var jg=function(a){var b="unauthorized-domain",c=void 0,d=gf(a);a=d.oa;d=d.pa;"chrome-extension"==d?c=oa("This chrome extension ID (chrome-extension://%s) is not authorized to run this operation. Add it to the OAuth redirect domains list in the Firebase console -> Auth section -> Sign in method tab.",a):"http"==d||"https"==d?c=oa("This domain (%s) is not authorized to run this operation. Add it to the OAuth redirect domains list in the Firebase console -> Auth section -> Sign in method tab.",a):b=
"operation-not-supported-in-this-environment";O.call(this,b,c)};t(jg,O);var kg=function(a){this.Pf=a.sub;na();this.Ib=a.email||null;this.Zf=a.provider_id||null;this.ef=!!a.is_anonymous||"anonymous"==this.Zf};kg.prototype.getEmail=function(){return this.Ib};kg.prototype.isAnonymous=function(){return this.ef};var lg=function(a,b){return a.then(function(a){if(a.idToken){a:{var c=a.idToken.split(".");if(3==c.length){c=c[1];for(var e=(4-c.length%4)%4,f=0;f<e;f++)c+=".";try{var g=JSON.parse(Ib(c));if(g.sub&&g.iss&&g.aud&&g.exp){var l=new kg(g);break a}}catch(n){}}l=null}if(!l||b!=l.Pf)throw new O("user-mismatch");return a}throw new O("user-mismatch");}).f(function(a){throw a&&a.code&&"auth/user-not-found"==a.code?new O("user-mismatch"):a;})},mg=function(a,b){if(b.idToken||b.accessToken)b.idToken&&N(this,"idToken",
b.idToken),b.accessToken&&N(this,"accessToken",b.accessToken);else if(b.oauthToken&&b.oauthTokenSecret)N(this,"accessToken",b.oauthToken),N(this,"secret",b.oauthTokenSecret);else throw new O("internal-error","failed to construct a credential");N(this,"providerId",a)};mg.prototype.Kb=function(a){return ng(a,og(this))};mg.prototype.Ec=function(a,b){var c=og(this);c.idToken=b;return pg(a,c)};mg.prototype.Ad=function(a,b){var c=og(this);return lg(qg(a,c),b)};
var og=function(a){var b={};a.idToken&&(b.id_token=a.idToken);a.accessToken&&(b.access_token=a.accessToken);a.secret&&(b.oauth_token_secret=a.secret);b.providerId=a.providerId;return{postBody:mf(b).toString(),requestUri:"http://localhost"}};mg.prototype.I=function(){var a={providerId:this.providerId};this.idToken&&(a.oauthIdToken=this.idToken);this.accessToken&&(a.oauthAccessToken=this.accessToken);this.secret&&(a.oauthTokenSecret=this.secret);return a};
var rg=function(a,b){this.bg=b||[];Xf(this,{providerId:a,isOAuthProvider:!0});this.ie={};this.yd=(eg(a)||{}).Cc||null;this.kd=null};rg.prototype.setCustomParameters=function(a){this.ie=lb(a);return this};var P=function(a){rg.call(this,a,cg);this.Od=[]};t(P,rg);P.prototype.addScope=function(a){Wa(this.Od,a)||this.Od.push(a);return this};P.prototype.pe=function(){return ab(this.Od)};
P.prototype.credential=function(a,b){if(!a&&!b)throw new O("argument-error","credential failed: must provide the ID token and/or the access token.");return new mg(this.providerId,{idToken:a||null,accessToken:b||null})};var sg=function(){P.call(this,"facebook.com")};t(sg,P);N(sg,"PROVIDER_ID","facebook.com");
var tg=function(a){if(!a)throw new O("argument-error","credential failed: expected 1 argument (the OAuth access token).");var b=a;q(a)&&(b=a.accessToken);return(new sg).credential(null,b)},ug=function(){P.call(this,"github.com")};t(ug,P);N(ug,"PROVIDER_ID","github.com");var vg=function(a){if(!a)throw new O("argument-error","credential failed: expected 1 argument (the OAuth access token).");var b=a;q(a)&&(b=a.accessToken);return(new ug).credential(null,b)},wg=function(){P.call(this,"google.com");this.addScope("profile")};
t(wg,P);N(wg,"PROVIDER_ID","google.com");var xg=function(a,b){var c=a;q(a)&&(c=a.idToken,b=a.accessToken);return(new wg).credential(c,b)},yg=function(){rg.call(this,"twitter.com",bg)};t(yg,rg);N(yg,"PROVIDER_ID","twitter.com");
var zg=function(a,b){var c=a;q(c)||(c={oauthToken:a,oauthTokenSecret:b});if(!c.oauthToken||!c.oauthTokenSecret)throw new O("argument-error","credential failed: expected 2 arguments (the OAuth access token and secret).");return new mg("twitter.com",c)},Ag=function(a,b){this.Ib=a;this.Fd=b;N(this,"providerId","password")};Ag.prototype.Kb=function(a){return Q(a,Bg,{email:this.Ib,password:this.Fd})};Ag.prototype.Ec=function(a,b){return Q(a,Cg,{idToken:b,email:this.Ib,password:this.Fd})};
Ag.prototype.Ad=function(a,b){return lg(this.Kb(a),b)};Ag.prototype.I=function(){return{email:this.Ib,password:this.Fd}};var Dg=function(){Xf(this,{providerId:"password",isOAuthProvider:!1})};Xf(Dg,{PROVIDER_ID:"password"});var Eg=function(a){if(!(a.verificationId&&a.Yc||a.fc&&a.phoneNumber))throw new O("internal-error");this.P=a;N(this,"providerId","phone")};Eg.prototype.Kb=function(a){return a.verifyPhoneNumber(Fg(this))};Eg.prototype.Ec=function(a,b){var c=Fg(this);c.idToken=b;return Q(a,Gg,c)};
Eg.prototype.Ad=function(a,b){var c=Fg(this);c.operation="REAUTH";a=Q(a,Hg,c);return lg(a,b)};Eg.prototype.I=function(){var a={providerId:"phone"};this.P.verificationId&&(a.verificationId=this.P.verificationId);this.P.Yc&&(a.verificationCode=this.P.Yc);this.P.fc&&(a.temporaryProof=this.P.fc);this.P.phoneNumber&&(a.phoneNumber=this.P.phoneNumber);return a};
var Fg=function(a){return a.P.fc&&a.P.phoneNumber?{temporaryProof:a.P.fc,phoneNumber:a.P.phoneNumber}:{sessionInfo:a.P.verificationId,code:a.P.Yc}},Ig=function(a){try{this.gf=a||firebase.auth()}catch(b){throw new O("argument-error","Either an instance of firebase.auth.Auth must be passed as an argument to the firebase.auth.PhoneAuthProvider constructor, or the default firebase App instance must be initialized via firebase.initializeApp().");}Xf(this,{providerId:"phone",isOAuthProvider:!1})};
Ig.prototype.verifyPhoneNumber=function(a,b){var c=this.gf.g;return E(b.verify()).then(function(d){if(!m(d))throw new O("argument-error","An implementation of firebase.auth.ApplicationVerifier.prototype.verify() must return a firebase.Promise that resolves with a string.");switch(b.type){case "recaptcha":return Q(c,Jg,{phoneNumber:a,recaptchaToken:d});default:throw new O("argument-error",'Only firebase.auth.ApplicationVerifiers with type="recaptcha" are currently supported.');}})};
var Kg=function(a,b){if(!a)throw new O("missing-verification-id");if(!b)throw new O("missing-verification-code");return new Eg({verificationId:a,Yc:b})};Xf(Ig,{PROVIDER_ID:"phone"});
var Lg=function(a){if(a.temporaryProof&&a.phoneNumber)return new Eg({fc:a.temporaryProof,phoneNumber:a.phoneNumber});var b=a&&a.providerId;if(!b||"password"===b)return null;var c=a&&a.oauthAccessToken,d=a&&a.oauthTokenSecret;a=a&&a.oauthIdToken;try{switch(b){case "google.com":return xg(a,c);case "facebook.com":return tg(c);case "github.com":return vg(c);case "twitter.com":return zg(c,d);default:return(new P(b)).credential(a,c)}}catch(e){return null}},Mg=function(a){if(!a.isOAuthProvider)throw new O("invalid-oauth-provider");
};var Ng=function(a,b,c){O.call(this,a,c);a=b||{};a.email&&N(this,"email",a.email);a.phoneNumber&&N(this,"phoneNumber",a.phoneNumber);a.credential&&N(this,"credential",a.credential)};t(Ng,O);Ng.prototype.I=function(){var a={code:this.code,message:this.message};this.email&&(a.email=this.email);this.phoneNumber&&(a.phoneNumber=this.phoneNumber);var b=this.credential&&this.credential.I();b&&nb(a,b);return a};Ng.prototype.toJSON=function(){return this.I()};
var Og=function(a){if(a.code){var b=a.code||"";0==b.indexOf("auth/")&&(b=b.substring(5));var c={credential:Lg(a)};if(a.email)c.email=a.email;else if(a.phoneNumber)c.phoneNumber=a.phoneNumber;else return new O(b,a.message||void 0);return new Ng(b,c,a.message)}return null};var Pg=function(a){this.vg=a};t(Pg,Kc);Pg.prototype.pc=function(){return new this.vg};Pg.prototype.wd=function(){return{}};
var R=function(a,b,c){var d="Node"==Df();d=k.XMLHttpRequest||d&&firebase.INTERNAL.node&&firebase.INTERNAL.node.XMLHttpRequest;if(!d)throw new O("internal-error","The XMLHttpRequest compatibility library was not found.");this.o=a;a=b||{};this.hg=a.secureTokenEndpoint||"https://securetoken.googleapis.com/v1/token";this.ig=a.secureTokenTimeout||Qg;this.Le=lb(a.secureTokenHeaders||Rg);this.sf=a.firebaseEndpoint||"https://www.googleapis.com/identitytoolkit/v3/relyingparty/";this.tf=a.firebaseTimeout||
Sg;this.qc=lb(a.firebaseHeaders||Tg);c&&(this.qc["X-Client-Version"]=c,this.Le["X-Client-Version"]=c);this.jf=new Pc;this.ug=new Pg(d)},Ug,Qg=new Rf(3E4,6E4),Rg={"Content-Type":"application/x-www-form-urlencoded"},Sg=new Rf(3E4,6E4),Tg={"Content-Type":"application/json"},Vg=function(a,b){b?a.qc.firebase_locale=b:delete a.qc.firebase_locale},Xg=function(a,b,c,d,e,f,g){Qf()?(sf()?a=r(a.kg,a):(Ug||(Ug=new D(function(a,b){Wg(a,b)})),a=r(a.jg,a)),a(b,c,d,e,f,g)):c&&c(null)};
R.prototype.kg=function(a,b,c,d,e,f){var g="Node"==Df(),l=Ef()?g?new I(this.ug):new I:new I(this.jf);if(f){l.zb=Math.max(0,f);var n=setTimeout(function(){l.dispatchEvent("timeout")},f)}l.listen("complete",function(){n&&clearTimeout(n);var a=null;try{a=JSON.parse(Re(this))||null}catch(wb){a=null}b&&b(a)});rc(l,"ready",function(){n&&clearTimeout(n);this.Ka||(this.Ka=!0,this.ib())});rc(l,"timeout",function(){n&&clearTimeout(n);this.Ka||(this.Ka=!0,this.ib());b&&b(null)});l.send(a,c,d,e)};
var Yg=Ia("https://apis.google.com/js/client.js?onload=%{onload}"),Zg="__fcb"+Math.floor(1E6*Math.random()).toString(),Wg=function(a,b){if(((window.gapi||{}).client||{}).request)a();else{k[Zg]=function(){((window.gapi||{}).client||{}).request?a():b(Error("CORS_UNSUPPORTED"))};var c=Na(Yg,{onload:Zg});Wd(de(c),function(){b(Error("CORS_UNSUPPORTED"))})}};
R.prototype.jg=function(a,b,c,d,e){var f=this;Ug.then(function(){window.gapi.client.setApiKey(f.o);var g=window.gapi.auth.getToken();window.gapi.auth.setToken(null);window.gapi.client.request({path:a,method:c,body:d,headers:e,authType:"none",callback:function(a){window.gapi.auth.setToken(g);b&&b(a)}})}).f(function(a){b&&b({error:{message:a&&a.message||"CORS_UNSUPPORTED"}})})};
var ah=function(a,b){return new D(function(c,d){"refresh_token"==b.grant_type&&b.refresh_token||"authorization_code"==b.grant_type&&b.code?Xg(a,a.hg+"?key="+encodeURIComponent(a.o),function(a){a?a.error?d($g(a)):a.access_token&&a.refresh_token?c(a):d(new O("internal-error")):d(new O("network-request-failed"))},"POST",mf(b).toString(),a.Le,a.ig.get()):d(new O("internal-error"))})},bh=function(a,b,c,d,e,f){var g=gf(a.sf+b);K(g,"key",a.o);f&&K(g,"cb",na().toString());var l="GET"==c;if(l)for(var n in d)d.hasOwnProperty(n)&&
K(g,n,d[n]);return new D(function(b,f){Xg(a,g.toString(),function(a){a?a.error?f($g(a,e||{})):b(a):f(new O("network-request-failed"))},c,l?void 0:Gc(Mf(d)),a.qc,a.tf.get())})},ch=function(a){if(!xc.test(a.email))throw new O("invalid-email");},dh=function(a){"email"in a&&ch(a)},fh=function(a,b){return Q(a,eh,{identifier:b,continueUri:If()?of():"http://localhost"}).then(function(a){return a.allProviders||[]})},hh=function(a){return Q(a,gh,{}).then(function(a){return a.authorizedDomains||[]})},ih=function(a){if(!a.idToken)throw new O("internal-error");
},jh=function(a){if(a.phoneNumber||a.temporaryProof){if(!a.phoneNumber||!a.temporaryProof)throw new O("internal-error");}else{if(!a.sessionInfo)throw new O("missing-verification-id");if(!a.code)throw new O("missing-verification-code");}};R.prototype.signInAnonymously=function(){return Q(this,kh,{})};R.prototype.updateEmail=function(a,b){return Q(this,lh,{idToken:a,email:b})};R.prototype.updatePassword=function(a,b){return Q(this,Cg,{idToken:a,password:b})};var mh={displayName:"DISPLAY_NAME",photoUrl:"PHOTO_URL"};
R.prototype.updateProfile=function(a,b){var c={idToken:a},d=[];fb(mh,function(a,f){var e=b[f];null===e?d.push(a):f in b&&(c[f]=e)});d.length&&(c.deleteAttribute=d);return Q(this,lh,c)};R.prototype.sendPasswordResetEmail=function(a,b){a={requestType:"PASSWORD_RESET",email:a};nb(a,b);return Q(this,nh,a)};R.prototype.sendEmailVerification=function(a,b){a={requestType:"VERIFY_EMAIL",idToken:a};nb(a,b);return Q(this,oh,a)};R.prototype.verifyPhoneNumber=function(a){return Q(this,ph,a)};
var rh=function(a,b,c){return Q(a,qh,{idToken:b,deleteProvider:c})},sh=function(a){if(!a.requestUri||!a.sessionId&&!a.postBody)throw new O("internal-error");},th=function(a){var b=null;a.needConfirmation?(a.code="account-exists-with-different-credential",b=Og(a)):"FEDERATED_USER_ID_ALREADY_LINKED"==a.errorMessage?(a.code="credential-already-in-use",b=Og(a)):"EMAIL_EXISTS"==a.errorMessage&&(a.code="email-already-in-use",b=Og(a));if(b)throw b;if(!a.idToken)throw new O("internal-error");},ng=function(a,
b){b.returnIdpCredential=!0;return Q(a,uh,b)},pg=function(a,b){b.returnIdpCredential=!0;return Q(a,vh,b)},qg=function(a,b){b.returnIdpCredential=!0;b.autoCreate=!1;return Q(a,wh,b)},xh=function(a){if(!a.oobCode)throw new O("invalid-action-code");};R.prototype.confirmPasswordReset=function(a,b){return Q(this,yh,{oobCode:a,newPassword:b})};R.prototype.checkActionCode=function(a){return Q(this,zh,{oobCode:a})};R.prototype.applyActionCode=function(a){return Q(this,Ah,{oobCode:a})};
var Ah={endpoint:"setAccountInfo",F:xh,$a:"email"},zh={endpoint:"resetPassword",F:xh,Y:function(a){if(!a.email||!a.requestType)throw new O("internal-error");}},Bh={endpoint:"signupNewUser",F:function(a){ch(a);if(!a.password)throw new O("weak-password");},Y:ih,za:!0},eh={endpoint:"createAuthUri"},Ch={endpoint:"deleteAccount",Ya:["idToken"]},qh={endpoint:"setAccountInfo",Ya:["idToken","deleteProvider"],F:function(a){if(!ia(a.deleteProvider))throw new O("internal-error");}},Dh={endpoint:"getAccountInfo"},
oh={endpoint:"getOobConfirmationCode",Ya:["idToken","requestType"],F:function(a){if("VERIFY_EMAIL"!=a.requestType)throw new O("internal-error");},$a:"email"},nh={endpoint:"getOobConfirmationCode",Ya:["requestType"],F:function(a){if("PASSWORD_RESET"!=a.requestType)throw new O("internal-error");ch(a)},$a:"email"},gh={ae:!0,endpoint:"getProjectConfig",ue:"GET"},Eh={ae:!0,endpoint:"getRecaptchaParam",ue:"GET",Y:function(a){if(!a.recaptchaSiteKey)throw new O("internal-error");}},yh={endpoint:"resetPassword",
F:xh,$a:"email"},Jg={endpoint:"sendVerificationCode",Ya:["phoneNumber","recaptchaToken"],$a:"sessionInfo"},lh={endpoint:"setAccountInfo",Ya:["idToken"],F:dh,za:!0},Cg={endpoint:"setAccountInfo",Ya:["idToken"],F:function(a){dh(a);if(!a.password)throw new O("weak-password");},Y:ih,za:!0},kh={endpoint:"signupNewUser",Y:ih,za:!0},uh={endpoint:"verifyAssertion",F:sh,Y:th,za:!0},wh={endpoint:"verifyAssertion",F:sh,Y:function(a){if(a.errorMessage&&"USER_NOT_FOUND"==a.errorMessage)throw new O("user-not-found");
if(!a.idToken)throw new O("internal-error");},za:!0},vh={endpoint:"verifyAssertion",F:function(a){sh(a);if(!a.idToken)throw new O("internal-error");},Y:th,za:!0},Fh={endpoint:"verifyCustomToken",F:function(a){if(!a.token)throw new O("invalid-custom-token");},Y:ih,za:!0},Bg={endpoint:"verifyPassword",F:function(a){ch(a);if(!a.password)throw new O("wrong-password");},Y:ih,za:!0},ph={endpoint:"verifyPhoneNumber",F:jh,Y:ih},Gg={endpoint:"verifyPhoneNumber",F:function(a){if(!a.idToken)throw new O("internal-error");
jh(a)},Y:function(a){if(a.temporaryProof)throw a.code="credential-already-in-use",Og(a);ih(a)}},Hg={mf:{USER_NOT_FOUND:"user-not-found"},endpoint:"verifyPhoneNumber",F:jh,Y:ih},Q=function(a,b,c){if(!$f(c,b.Ya))return F(new O("internal-error"));var d=b.ue||"POST",e;return E(c).then(b.F).then(function(){b.za&&(c.returnSecureToken=!0);return bh(a,b.endpoint,d,c,b.mf,b.ae||!1)}).then(function(a){return e=a}).then(b.Y).then(function(){if(!b.$a)return e;if(!(b.$a in e))throw new O("internal-error");return e[b.$a]})},
$g=function(a,b){var c=(a.error&&a.error.errors&&a.error.errors[0]||{}).reason||"";var d={keyInvalid:"invalid-api-key",ipRefererBlocked:"app-not-authorized"};if(c=d[c]?new O(d[c]):null)return c;c=a.error&&a.error.message||"";d={INVALID_CUSTOM_TOKEN:"invalid-custom-token",CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_EMAIL:"invalid-email",INVALID_PASSWORD:"wrong-password",USER_DISABLED:"user-disabled",
MISSING_PASSWORD:"internal-error",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",INVALID_MESSAGE_PAYLOAD:"invalid-message-payload",INVALID_RECIPIENT_EMAIL:"invalid-recipient-email",INVALID_SENDER:"invalid-sender",EMAIL_NOT_FOUND:"user-not-found",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",
INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",CORS_UNSUPPORTED:"cors-unsupported",DYNAMIC_LINK_NOT_ACTIVATED:"dynamic-link-not-activated",INVALID_APP_ID:"invalid-app-id",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",WEAK_PASSWORD:"weak-password",OPERATION_NOT_ALLOWED:"operation-not-allowed",USER_CANCELLED:"user-cancelled",CAPTCHA_CHECK_FAILED:"captcha-check-failed",INVALID_APP_CREDENTIAL:"invalid-app-credential",INVALID_CODE:"invalid-verification-code",
INVALID_PHONE_NUMBER:"invalid-phone-number",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_APP_CREDENTIAL:"missing-app-credential",MISSING_CODE:"missing-verification-code",MISSING_PHONE_NUMBER:"missing-phone-number",MISSING_SESSION_INFO:"missing-verification-id",QUOTA_EXCEEDED:"quota-exceeded",SESSION_EXPIRED:"code-expired",INVALID_CONTINUE_URI:"invalid-continue-uri",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",MISSING_IOS_BUNDLE_ID:"missing-ios-bundle-id",
UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri"};nb(d,b||{});b=(b=c.match(/^[^\s]+\s*:\s*(.*)$/))&&1<b.length?b[1]:void 0;for(var e in d)if(0===c.indexOf(e))return new O(d[e],b);!b&&a&&(b=Lf(a));return new O("internal-error",b)};var Gh=function(a){this.D=a};Gh.prototype.value=function(){return this.D};Gh.prototype.Ne=function(a){this.D.style=a;return this};Gh.prototype.getStyle=function(){return this.D.style};var Hh=function(a){this.D=a||{}};h=Hh.prototype;h.value=function(){return this.D};h.getUrl=function(){return this.D.url};h.Ne=function(a){this.D.style=a;return this};h.getStyle=function(){return this.D.style};h.getId=function(){return this.D.id};h.getContext=function(){return this.D.context};var Jh=function(a){this.sg=a;this.xc=null;this.Cd=Ih(this)},Kh=function(a){var b=new Hh;b.D.where=document.body;b.D.url=a.sg;b.D.messageHandlersFilter=M("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER");b.D.attributes=b.D.attributes||{};(new Gh(b.D.attributes)).Ne({position:"absolute",top:"-100px",width:"1px",height:"1px"});b.D.dontclear=!0;return b},Ih=function(a){return Lh().then(function(){return new D(function(b,c){M("gapi.iframes.getContext")().open(Kh(a).value(),function(d){a.xc=d;a.xc.restyle({setHideOnLeave:!1});
var e=setTimeout(function(){c(Error("Network Error"))},Mh.get()),f=function(){clearTimeout(e);b()};d.ping(f).then(f,function(){c(Error("Network Error"))})})})})};Jh.prototype.sendMessage=function(a){var b=this;return this.Cd.then(function(){return new D(function(c){b.xc.send(a.type,a,c,M("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"))})})};
var Nh=function(a,b){a.Cd.then(function(){a.xc.register("authEvent",b,M("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"))})},Oh=Ia("https://apis.google.com/js/api.js?onload=%{onload}"),Ph=new Rf(3E4,6E4),Mh=new Rf(5E3,15E3),Qh=null,Lh=function(){return Qh?Qh:Qh=(new D(function(a,b){if(Qf()){var c=function(){Pf();M("gapi.load")("gapi.iframes",{callback:a,ontimeout:function(){Pf();b(Error("Network Error"))},timeout:Ph.get()})};if(M("gapi.iframes.Iframe"))a();else if(M("gapi.load"))c();else{var d="__iframefcb"+
Math.floor(1E6*Math.random()).toString();k[d]=function(){M("gapi.load")?c():b(Error("Network Error"))};d=Na(Oh,{onload:d});E(de(d)).f(function(){b(Error("Network Error"))})}}else b(Error("Network Error"))})).f(function(a){Qh=null;throw a;})};var Rh=function(a,b,c){this.C=a;this.o=b;this.u=c;this.bb=null;this.ic=hf(this.C,"/__/auth/iframe");K(this.ic,"apiKey",this.o);K(this.ic,"appName",this.u)};Rh.prototype.Td=function(a){this.bb=a;return this};Rh.prototype.toString=function(){this.bb?K(this.ic,"v",this.bb):this.ic.removeParameter("v");return this.ic.toString()};var Sh=function(a,b,c,d,e){this.C=a;this.o=b;this.u=c;this.ff=d;this.bb=this.U=this.Md=null;this.tb=e};Sh.prototype.Td=function(a){this.bb=a;return this};
Sh.prototype.toString=function(){var a=hf(this.C,"/__/auth/handler");K(a,"apiKey",this.o);K(a,"appName",this.u);K(a,"authType",this.ff);if(this.tb.isOAuthProvider){var b=this.tb;try{var c=firebase.app(this.u).auth().ha}catch(l){c=null}b.kd=c;K(a,"providerId",this.tb.providerId);b=this.tb;c=Mf(b.ie);for(var d in c)c[d]=c[d].toString();d=b.bg;c=lb(c);for(var e=0;e<d.length;e++){var f=d[e];f in c&&delete c[f]}b.yd&&b.kd&&!c[b.yd]&&(c[b.yd]=b.kd);jb(c)||K(a,"customParameters",Lf(c))}"function"===typeof this.tb.pe&&
(b=this.tb.pe(),b.length&&K(a,"scopes",b.join(",")));this.Md?K(a,"redirectUrl",this.Md):a.removeParameter("redirectUrl");this.U?K(a,"eventId",this.U):a.removeParameter("eventId");this.bb?K(a,"v",this.bb):a.removeParameter("v");if(this.kc)for(var g in this.kc)this.kc.hasOwnProperty(g)&&!ff(a,g)&&K(a,g,this.kc[g]);return a.toString()};
var Th=function(a,b,c,d){this.C=a;this.o=b;this.u=c;this.vf=(this.Ja=d||null)?Ff(this.Ja):null;d=this.Ja;this.Ef=(new Rh(a,b,c)).Td(d).toString();this.sa=[];this.g=new R(b,null,this.vf);this.zc=this.va=null},Uh=function(a){var b=of();return hh(a).then(function(a){a:{var c=gf(b),e=c.pa;c=c.oa;for(var f=0;f<a.length;f++){var g=a[f];var l=c;var n=e;0==g.indexOf("chrome-extension://")?l=gf(g).oa==l&&"chrome-extension"==n:"http"!=n&&"https"!=n?l=!1:xf.test(g)?l=l==g:(g=g.split(".").join("\\."),l=(new RegExp("^(.+\\."+
g+"|"+g+")$","i")).test(l));if(l){a=!0;break a}}a=!1}if(!a)throw new jg(of());})};h=Th.prototype;h.Ob=function(){if(this.zc)return this.zc;var a=this;return this.zc=yf().then(function(){a.wc=new Jh(a.Ef);Vh(a)})};h.cc=function(a,b,c){var d=new O("popup-closed-by-user"),e=new O("web-storage-unsupported"),f=this,g=!1;return this.Pa().then(function(){Wh(f).then(function(c){c||(a&&uf(a),b(e),g=!0)})}).f(function(){}).then(function(){if(!g)return wf(a)}).then(function(){if(!g)return Be(c).then(function(){b(d)})})};
h.Oe=function(){var a=L();return!Kf(a)&&!Of(a)};h.se=function(){return!1};h.Wb=function(a,b,c,d,e,f,g){if(!a)return F(new O("popup-blocked"));if(g&&!Kf())return this.Pa().f(function(b){uf(a);e(b)}),d(),E();this.va||(this.va=Uh(this.g));var l=this;return this.va.then(function(){var b=l.Pa().f(function(b){uf(a);e(b);throw b;});d();return b}).then(function(){Mg(c);if(!g){var d=Xh(l.C,l.o,l.u,b,c,null,f,l.Ja);pf(d,a)}}).f(function(a){"auth/network-request-failed"==a.code&&(l.va=null);throw a;})};
h.Xb=function(a,b,c){this.va||(this.va=Uh(this.g));var d=this;return this.va.then(function(){Mg(b);var e=Xh(d.C,d.o,d.u,a,b,of(),c,d.Ja);pf(e)}).f(function(a){"auth/network-request-failed"==a.code&&(d.va=null);throw a;})};h.Pa=function(){var a=this;return this.Ob().then(function(){return a.wc.Cd}).f(function(){a.va=null;throw new O("network-request-failed");})};h.Se=function(){return!0};
var Xh=function(a,b,c,d,e,f,g,l,n){a=new Sh(a,b,c,d,e);a.Md=f;a.U=g;f=a.Td(l);f.kc=lb(n||null);return f.toString()},Vh=function(a){if(!a.wc)throw Error("IfcHandler must be initialized!");Nh(a.wc,function(b){var c={};if(b&&b.authEvent){var d=!1;b=ig(b.authEvent);for(c=0;c<a.sa.length;c++)d=a.sa[c](b)||d;c={};c.status=d?"ACK":"ERROR";return E(c)}c.status="ERROR";return E(c)})},Wh=function(a){var b={type:"webStorageSupport"};return a.Ob().then(function(){return a.wc.sendMessage(b)}).then(function(a){if(a&&
a.length&&"undefined"!==typeof a[0].webStorageSupport)return a[0].webStorageSupport;throw Error();})};Th.prototype.fb=function(a){this.sa.push(a)};Th.prototype.$b=function(a){Za(this.sa,function(b){return b==a})};var Yh=function(a,b,c){N(this,"type","recaptcha");this.Zc=this.Eb=null;this.Gb=!1;this.ge=a;this.Ca=b||{theme:"light",type:"image"};this.K=[];if(this.Ca.sitekey)throw new O("argument-error","sitekey should not be provided for reCAPTCHA as one is automatically provisioned for the current project.");this.Ac="invisible"===this.Ca.size;if(!ld(a)||!this.Ac&&ld(a).hasChildNodes())throw new O("argument-error","reCAPTCHA container is either not found or already contains inner elements!");try{this.i=c||firebase.app()}catch(g){throw new O("argument-error",
"No firebase.app.App instance is currently initialized.");}if(this.i.options&&this.i.options.apiKey)a=firebase.SDK_VERSION?Ff(firebase.SDK_VERSION):null,this.g=new R(this.i.options&&this.i.options.apiKey,null,a);else throw new O("invalid-api-key");var d=this;this.Uc=[];var e=this.Ca.callback;this.Ca.callback=function(a){d.Hb(a);if("function"===typeof e)e(a);else if("string"===typeof e){var b=M(e,k);"function"===typeof b&&b(a)}};var f=this.Ca["expired-callback"];this.Ca["expired-callback"]=function(){d.Hb(null);
if("function"===typeof f)f();else if("string"===typeof f){var a=M(f,k);"function"===typeof a&&a()}}};Yh.prototype.Hb=function(a){for(var b=0;b<this.Uc.length;b++)try{this.Uc[b](a)}catch(c){}};var Zh=function(a,b){Za(a.Uc,function(a){return a==b})};Yh.prototype.c=function(a){var b=this;this.K.push(a);Ed(a,function(){Ya(b.K,a)});return a};
Yh.prototype.Pb=function(){var a=this;return this.Eb?this.Eb:this.Eb=this.c(E().then(function(){if(If())return yf();throw new O("operation-not-supported-in-this-environment","RecaptchaVerifier is only supported in a browser HTTP/HTTPS environment.");}).then(function(){try{var b=a.i.auth().ha}catch(c){b=null}return $h(ai(),b)}).then(function(){return Q(a.g,Eh,{})}).then(function(b){a.Ca.sitekey=b.recaptchaSiteKey}).f(function(b){a.Eb=null;throw b;}))};
Yh.prototype.render=function(){bi(this);var a=this;return this.c(this.Pb().then(function(){if(null===a.Zc){var b=a.ge;if(!a.Ac){var c=ld(b);b=pd("DIV");c.appendChild(b)}a.Zc=grecaptcha.render(b,a.Ca)}return a.Zc}))};Yh.prototype.verify=function(){bi(this);var a=this;return this.c(this.render().then(function(b){return new D(function(c){var d=grecaptcha.getResponse(b);if(d)c(d);else{var e=function(b){b&&(Zh(a,e),c(b))};a.Uc.push(e);a.Ac&&grecaptcha.execute(a.Zc)}})}))};
var bi=function(a){if(a.Gb)throw new O("internal-error","RecaptchaVerifier instance has been destroyed.");};Yh.prototype.clear=function(){bi(this);this.Gb=!0;ai().hd--;for(var a=0;a<this.K.length;a++)this.K[a].cancel("RecaptchaVerifier instance has been destroyed.");if(!this.Ac){a=ld(this.ge);for(var b;b=a.firstChild;)a.removeChild(b)}};
var ci=Ia("https://www.google.com/recaptcha/api.js?onload=%{onload}&render=explicit&hl=%{hl}"),di=function(){this.hd=k.grecaptcha?Infinity:0;this.te=null;this.fd="__rcb"+Math.floor(1E6*Math.random()).toString()},$h=function(a,b){return new D(function(c,d){if(Qf())if(!k.grecaptcha||b!==a.te&&!a.hd){k[a.fd]=function(){if(k.grecaptcha){a.te=b;var e=k.grecaptcha.render;k.grecaptcha.render=function(b,c){b=e(b,c);a.hd++;return b};c()}else d(new O("internal-error"));delete k[a.fd]};var e=Na(ci,{onload:a.fd,
hl:b||""});E(de(e)).f(function(){d(new O("internal-error","Unable to load external reCAPTCHA dependencies!"))})}else c();else d(new O("network-request-failed"))})},ei=null,ai=function(){ei||(ei=new di);return ei};var fi=function(a){this.G=a||firebase.INTERNAL.reactNative&&firebase.INTERNAL.reactNative.AsyncStorage;if(!this.G)throw new O("internal-error","The React Native compatibility library was not found.");};h=fi.prototype;h.get=function(a){return E(this.G.getItem(a)).then(function(a){return a&&Nf(a)})};h.set=function(a,b){return E(this.G.setItem(a,Lf(b)))};h.remove=function(a){return E(this.G.removeItem(a))};h.gb=function(){};h.Xa=function(){};var gi=function(){this.G={}};h=gi.prototype;h.get=function(a){return E(this.G[a])};h.set=function(a,b){this.G[a]=b;return E()};h.remove=function(a){delete this.G[a];return E()};h.gb=function(){};h.Xa=function(){};var ii=function(){if(!hi()){if("Node"==Df())throw new O("internal-error","The LocalStorage compatibility library was not found.");throw new O("web-storage-unsupported");}this.G=k.localStorage||firebase.INTERNAL.node.localStorage},hi=function(){var a="Node"==Df();a=k.localStorage||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.localStorage;if(!a)return!1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return!1}};h=ii.prototype;
h.get=function(a){var b=this;return E().then(function(){var c=b.G.getItem(a);return Nf(c)})};h.set=function(a,b){var c=this;return E().then(function(){var d=Lf(b);null===d?c.remove(a):c.G.setItem(a,d)})};h.remove=function(a){var b=this;return E().then(function(){b.G.removeItem(a)})};h.gb=function(a){k.window&&kc(k.window,"storage",a)};h.Xa=function(a){k.window&&sc(k.window,"storage",a)};var ji=function(){this.G={}};h=ji.prototype;h.get=function(){return E(null)};h.set=function(){return E()};h.remove=function(){return E()};h.gb=function(){};h.Xa=function(){};var li=function(){if(!ki()){if("Node"==Df())throw new O("internal-error","The SessionStorage compatibility library was not found.");throw new O("web-storage-unsupported");}this.G=k.sessionStorage||firebase.INTERNAL.node.sessionStorage},ki=function(){var a="Node"==Df();a=k.sessionStorage||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.sessionStorage;if(!a)return!1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return!1}};h=li.prototype;
h.get=function(a){var b=this;return E().then(function(){var c=b.G.getItem(a);return Nf(c)})};h.set=function(a,b){var c=this;return E().then(function(){var d=Lf(b);null===d?c.remove(a):c.G.setItem(a,d)})};h.remove=function(a){var b=this;return E().then(function(){b.G.removeItem(a)})};h.gb=function(){};h.Xa=function(){};var ni=function(a,b,c,d,e,f){if(!window.indexedDB)throw new O("web-storage-unsupported");this.nf=a;this.Bd=b;this.jd=c;this.We=d;this.cb=e;this.W={};this.dc=[];this.Sb=0;this.Gf=f||k.indexedDB},oi,pi=function(a){return new D(function(b,c){var d=a.Gf.open(a.nf,a.cb);d.onerror=function(a){c(Error(a.target.errorCode))};d.onupgradeneeded=function(b){b=b.target.result;try{b.createObjectStore(a.Bd,{keyPath:a.jd})}catch(f){c(f)}};d.onsuccess=function(a){b(a.target.result)}})},qi=function(a){a.xe||(a.xe=
pi(a));return a.xe},ri=function(a,b){return b.objectStore(a.Bd)},si=function(a,b,c){return b.transaction([a.Bd],c?"readwrite":"readonly")},ti=function(a){return new D(function(b,c){a.onsuccess=function(a){a&&a.target?b(a.target.result):b()};a.onerror=function(a){c(Error(a.target.errorCode))}})};h=ni.prototype;
h.set=function(a,b){var c=!1,d,e=this;return Ed(qi(this).then(function(b){d=b;b=ri(e,si(e,d,!0));return ti(b.get(a))}).then(function(f){var g=ri(e,si(e,d,!0));if(f)return f.value=b,ti(g.put(f));e.Sb++;c=!0;f={};f[e.jd]=a;f[e.We]=b;return ti(g.add(f))}).then(function(){e.W[a]=b}),function(){c&&e.Sb--})};h.get=function(a){var b=this;return qi(this).then(function(c){return ti(ri(b,si(b,c,!1)).get(a))}).then(function(a){return a&&a.value})};
h.remove=function(a){var b=!1,c=this;return Ed(qi(this).then(function(d){b=!0;c.Sb++;return ti(ri(c,si(c,d,!0))["delete"](a))}).then(function(){delete c.W[a]}),function(){b&&c.Sb--})};
h.og=function(){var a=this;return qi(this).then(function(b){var c=ri(a,si(a,b,!1));return c.getAll?ti(c.getAll()):new D(function(a,b){var d=[],e=c.openCursor();e.onsuccess=function(b){(b=b.target.result)?(d.push(b.value),b["continue"]()):a(d)};e.onerror=function(a){b(Error(a.target.errorCode))}})}).then(function(b){var c={},d=[];if(0==a.Sb){for(d=0;d<b.length;d++)c[b[d][a.jd]]=b[d][a.We];d=qf(a.W,c);a.W=c}return d})};h.gb=function(a){0==this.dc.length&&this.Vd();this.dc.push(a)};
h.Xa=function(a){Za(this.dc,function(b){return b==a});0==this.dc.length&&this.Qc()};h.Vd=function(){var a=this;this.Qc();var b=function(){a.Hd=Be(800).then(r(a.og,a)).then(function(b){0<b.length&&x(a.dc,function(a){a(b)})}).then(b).f(function(a){"STOP_EVENT"!=a.message&&b()});return a.Hd};b()};h.Qc=function(){this.Hd&&this.Hd.cancel("STOP_EVENT")};var xi=function(){this.ke={Browser:ui,Node:vi,ReactNative:wi}[Df()]},yi,ui={B:ii,Xd:li},vi={B:ii,Xd:li},wi={B:fi,Xd:ji};var zi=function(a){this.vd(a)};
zi.prototype.vd=function(a){var b=a.url;if("undefined"===typeof b)throw new O("missing-continue-uri");if("string"!==typeof b||"string"===typeof b&&!b.length)throw new O("invalid-continue-uri");this.hf=b;this.Zd=this.lc=null;this.ye=!1;var c=a.android;if(c&&"object"===typeof c){b=c.packageName;var d=c.installApp;c=c.minimumVersion;if("string"===typeof b&&b.length){this.lc=b;if("undefined"!==typeof d&&"boolean"!==typeof d)throw new O("argument-error","installApp property must be a boolean when specified.");this.ye=
!!d;if("undefined"!==typeof c&&("string"!==typeof c||"string"===typeof c&&!c.length))throw new O("argument-error","minimumVersion property must be a non empty string when specified.");this.Zd=c||null}else{if("undefined"!==typeof b)throw new O("argument-error","packageName property must be a non empty string when specified.");if("undefined"!==typeof d||"undefined"!==typeof c)throw new O("missing-android-pkg-name");}}else if("undefined"!==typeof c)throw new O("argument-error","android property must be a non null object when specified.");
this.sd=null;if((b=a.iOS)&&"object"===typeof b)if(b=b.bundleId,"string"===typeof b&&b.length)this.sd=b;else{if("undefined"!==typeof b)throw new O("argument-error","bundleId property must be a non empty string when specified.");}else if("undefined"!==typeof b)throw new O("argument-error","iOS property must be a non null object when specified.");a=a.handleCodeInApp;if("undefined"!==typeof a&&"boolean"!==typeof a)throw new O("argument-error","handleCodeInApp property must be a boolean when specified.");
if((this.ee=!!a)&&!this.sd&&!this.lc)throw new O("argument-error","handleCodeInApp property can't be true when no mobile application is provided.");};var Ai=function(a){var b={};b.continueUrl=a.hf;b.canHandleCodeInApp=a.ee;if(b.androidPackageName=a.lc)b.androidMinimumVersion=a.Zd,b.androidInstallApp=a.ye;b.iOSBundleId=a.sd;for(var c in b)null===b[c]&&delete b[c];return b};var Bi=function(a,b){this.lf=b;N(this,"verificationId",a)};Bi.prototype.confirm=function(a){a=Kg(this.verificationId,a);return this.lf(a)};var Ci=function(a,b,c,d){return(new Ig(a)).verifyPhoneNumber(b,c).then(function(a){return new Bi(a,d)})};var Di=function(a){var b={},c=a.email,d=a.newEmail;a=a.requestType;if(!c||!a)throw Error("Invalid provider user info!");b.fromEmail=d||null;b.email=c;N(this,"operation",a);N(this,"data",ag(b))};var Ei=function(a,b,c,d,e,f){this.Wf=a;this.dg=b;this.yf=c;this.Fc=d;this.Yd=e;this.eg=!!f;this.qb=null;this.Qa=this.Fc;if(this.Yd<this.Fc)throw Error("Proactive refresh lower bound greater than upper bound!");};Ei.prototype.start=function(){this.Qa=this.Fc;Fi(this,!0)};
var Gi=function(a,b){if(b)return a.Qa=a.Fc,a.yf();b=a.Qa;a.Qa*=2;a.Qa>a.Yd&&(a.Qa=a.Yd);return b},Fi=function(a,b){a.stop();a.qb=Be(Gi(a,b)).then(function(){return a.eg?E():Tf()}).then(function(){return a.Wf()}).then(function(){Fi(a,!0)}).f(function(b){a.dg(b)&&Fi(a,!1)})};Ei.prototype.stop=function(){this.qb&&(this.qb.cancel(),this.qb=null)};var Mi=function(a){var b={};b["facebook.com"]=Hi;b["google.com"]=Ii;b["github.com"]=Ji;b["twitter.com"]=Ki;var c=a&&a.providerId;return c?b[c]?new b[c](a):new Li(a):null},Li=function(a){var b=Nf(a.rawUserInfo||"{}");a=a.providerId;if(!a)throw Error("Invalid additional user info!");N(this,"profile",ag(b||{}));N(this,"providerId",a)},Hi=function(a){Li.call(this,a);if("facebook.com"!=this.providerId)throw Error("Invalid provider id!");};t(Hi,Li);
var Ji=function(a){Li.call(this,a);if("github.com"!=this.providerId)throw Error("Invalid provider id!");N(this,"username",this.profile&&this.profile.login||null)};t(Ji,Li);var Ii=function(a){Li.call(this,a);if("google.com"!=this.providerId)throw Error("Invalid provider id!");};t(Ii,Li);var Ki=function(a){Li.call(this,a);if("twitter.com"!=this.providerId)throw Error("Invalid provider id!");N(this,"username",a.screenName||null)};t(Ki,Li);var Ni={zg:"local",NONE:"none",Ag:"session"},Oi=function(a){var b=new O("invalid-persistence-type"),c=new O("unsupported-persistence-type");a:{for(d in Ni)if(Ni[d]==a){var d=!0;break a}d=!1}if(!d||"string"!==typeof a)throw b;switch(Df()){case "ReactNative":if("session"===a)throw c;break;case "Node":if("none"!==a)throw c;break;default:if(!Hf()&&"none"!==a)throw c;}},Pi=function(a,b,c,d){this.Ce=a;this.Pd=b;this.fg=c;this.ac=d;this.V={};yi||(yi=new xi);a=yi;try{if(nf()){oi||(oi=new ni("firebaseLocalStorageDb",
"firebaseLocalStorage","fbase_key","value",1));var e=oi}else e=new a.ke.B;this.He=e}catch(f){this.He=new gi,this.ac=!0}try{this.Re=new a.ke.Xd}catch(f){this.Re=new gi}this.Ff=new gi;this.Wd=r(this.Pe,this);this.W={}},Qi,Ri=function(){Qi||(Qi=new Pi("firebase",":",!Of(L())&&Cf()?!0:!1,Kf()));return Qi},Si=function(a,b){switch(b){case "session":return a.Re;case "none":return a.Ff;default:return a.He}};h=Pi.prototype;h.aa=function(a,b){return this.Ce+this.Pd+a.name+(b?this.Pd+b:"")};
h.get=function(a,b){return Si(this,a.B).get(this.aa(a,b))};h.remove=function(a,b){b=this.aa(a,b);"local"!=a.B||this.ac||(this.W[b]=null);return Si(this,a.B).remove(b)};h.set=function(a,b,c){var d=this.aa(a,c),e=this,f=Si(this,a.B);return f.set(d,b).then(function(){return f.get(d)}).then(function(b){"local"!=a.B||this.ac||(e.W[d]=b)})};h.addListener=function(a,b,c){a=this.aa(a,b);this.ac||(this.W[a]=k.localStorage.getItem(a));jb(this.V)&&this.Vd();this.V[a]||(this.V[a]=[]);this.V[a].push(c)};
h.removeListener=function(a,b,c){a=this.aa(a,b);this.V[a]&&(Za(this.V[a],function(a){return a==c}),0==this.V[a].length&&delete this.V[a]);jb(this.V)&&this.Qc()};h.Vd=function(){Si(this,"local").gb(this.Wd);this.ac||nf()||Ti(this)};var Ti=function(a){Ui(a);a.zd=setInterval(function(){for(var b in a.V){var c=k.localStorage.getItem(b),d=a.W[b];c!=d&&(a.W[b]=c,c=new Yb({type:"storage",key:b,target:window,oldValue:d,newValue:c,Gd:!0}),a.Pe(c))}},1E3)},Ui=function(a){a.zd&&(clearInterval(a.zd),a.zd=null)};
Pi.prototype.Qc=function(){Si(this,"local").Xa(this.Wd);Ui(this)};
Pi.prototype.Pe=function(a){if(a&&a.wf){var b=a.fa.key;if(0==b.indexOf(this.Ce+this.Pd)&&this.V[b]){"undefined"!==typeof a.fa.Gd?Si(this,"local").Xa(this.Wd):Ui(this);if(this.fg){var c=k.localStorage.getItem(b),d=a.fa.newValue;if(d!==c)null!==d?k.localStorage.setItem(b,d):k.localStorage.removeItem(b);else if(this.W[b]===d&&"undefined"===typeof a.fa.Gd)return}if("undefined"!==typeof a.fa.Gd||this.W[b]!==k.localStorage.getItem(b))this.W[b]=k.localStorage.getItem(b),this.ce(b)}}else x(a,r(this.ce,this))};
Pi.prototype.ce=function(a){this.V[a]&&x(this.V[a],function(a){a()})};var Vi=function(a,b){this.j=a;this.h=b||Ri()},Wi={name:"authEvent",B:"local"},Xi=function(a){return a.h.get(Wi,a.j).then(function(a){return ig(a)})};Vi.prototype.fb=function(a){this.h.addListener(Wi,this.j,a)};Vi.prototype.$b=function(a){this.h.removeListener(Wi,this.j,a)};var Yi=function(a){this.h=a||Ri()},Zi={name:"sessionId",B:"session"};Yi.prototype.sc=function(a){return this.h.get(Zi,a)};var $i=function(a,b,c,d,e,f){this.C=a;this.o=b;this.u=c;this.Ja=d||null;this.Qe=b+":"+c;this.gg=new Yi;this.oe=new Vi(this.Qe);this.ud=null;this.sa=[];this.Kf=e||500;this.$f=f||2E3;this.Nb=this.Ic=null},aj=function(a){return new O("invalid-cordova-configuration",a)};
$i.prototype.Pa=function(){return this.Pb?this.Pb:this.Pb=Af().then(function(){if("function"!==typeof M("universalLinks.subscribe",k))throw aj("cordova-universal-links-plugin is not installed");if("undefined"===typeof M("BuildInfo.packageName",k))throw aj("cordova-plugin-buildinfo is not installed");if("function"!==typeof M("cordova.plugins.browsertab.openUrl",k))throw aj("cordova-plugin-browsertab is not installed");if("function"!==typeof M("cordova.InAppBrowser.open",k))throw aj("cordova-plugin-inappbrowser is not installed");
},function(){throw new O("cordova-not-ready");})};var bj=function(){for(var a=20,b=[];0<a;)b.push("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(62*Math.random()))),a--;return b.join("")},cj=function(a){var b=new Tb;b.update(a);return bb(b.digest())};h=$i.prototype;h.cc=function(a,b){b(new O("operation-not-supported-in-this-environment"));return E()};h.Wb=function(){return F(new O("operation-not-supported-in-this-environment"))};h.Se=function(){return!1};h.Oe=function(){return!0};
h.se=function(){return!0};
h.Xb=function(a,b,c){if(this.Ic)return F(new O("redirect-operation-pending"));var d=this,e=k.document,f=null,g=null,l=null,n=null;return this.Ic=Ed(E().then(function(){Mg(b);return dj(d)}).then(function(){return ej(d,a,b,c)}).then(function(){return(new D(function(a,b){g=function(){var b=M("cordova.plugins.browsertab.close",k);a();"function"===typeof b&&b();d.Nb&&"function"===typeof d.Nb.close&&(d.Nb.close(),d.Nb=null);return!1};d.fb(g);l=function(){f||(f=Be(d.$f).then(function(){b(new O("redirect-cancelled-by-user"))}))};n=
function(){Sf()&&l()};e.addEventListener("resume",l,!1);L().toLowerCase().match(/android/)||e.addEventListener("visibilitychange",n,!1)})).f(function(a){return fj(d).then(function(){throw a;})})}),function(){l&&e.removeEventListener("resume",l,!1);n&&e.removeEventListener("visibilitychange",n,!1);f&&f.cancel();g&&d.$b(g);d.Ic=null})};
var ej=function(a,b,c,d){var e=bj(),f=new hg(b,d,null,e,new O("no-auth-event")),g=M("BuildInfo.packageName",k);if("string"!==typeof g)throw new O("invalid-cordova-configuration");var l=M("BuildInfo.displayName",k),n={};if(L().toLowerCase().match(/iphone|ipad|ipod/))n.ibi=g;else if(L().toLowerCase().match(/android/))n.apn=g;else return F(new O("operation-not-supported-in-this-environment"));l&&(n.appDisplayName=l);e=cj(e);n.sessionId=e;var C=Xh(a.C,a.o,a.u,b,c,null,d,a.Ja,n);return a.Pa().then(function(){var b=
a.Qe;return a.gg.h.set(Wi,f.I(),b)}).then(function(){var b=M("cordova.plugins.browsertab.isAvailable",k);if("function"!==typeof b)throw new O("invalid-cordova-configuration");var c=null;b(function(b){if(b){c=M("cordova.plugins.browsertab.openUrl",k);if("function"!==typeof c)throw new O("invalid-cordova-configuration");c(C)}else{c=M("cordova.InAppBrowser.open",k);if("function"!==typeof c)throw new O("invalid-cordova-configuration");b=c;var d=L();d=!(!d.match(/(iPad|iPhone|iPod).*OS 7_\d/i)&&!d.match(/(iPad|iPhone|iPod).*OS 8_\d/i));
a.Nb=b(C,d?"_blank":"_system","location=yes")}})})};$i.prototype.Hb=function(a){for(var b=0;b<this.sa.length;b++)try{this.sa[b](a)}catch(c){}};
var dj=function(a){a.ud||(a.ud=a.Pa().then(function(){return new D(function(b){var c=function(d){b(d);a.$b(c);return!1};a.fb(c);gj(a)})}));return a.ud},fj=function(a){var b=null;return Xi(a.oe).then(function(c){b=c;c=a.oe;return c.h.remove(Wi,c.j)}).then(function(){return b})},gj=function(a){var b=M("universalLinks.subscribe",k);if("function"!==typeof b)throw new O("invalid-cordova-configuration");var c=new hg("unknown",null,null,null,new O("no-auth-event")),d=!1,e=Be(a.Kf).then(function(){return fj(a).then(function(){d||
a.Hb(c)})}),f=function(b){d=!0;e&&e.cancel();fj(a).then(function(d){var e=c;if(d&&b&&b.url){e=null;var f=b.url;var g=gf(f),l=ff(g,"link"),n=ff(gf(l),"link");g=ff(g,"deep_link_id");f=ff(gf(g),"link")||g||n||l||f;-1!=f.indexOf("/__/auth/callback")&&(e=gf(f),e=Nf(ff(e,"firebaseError")||null),e=(e="object"===typeof e?gg(e):null)?new hg(d.la,d.U,null,null,e):new hg(d.la,d.U,f,d.sc()));e=e||c}a.Hb(e)})},g=k.handleOpenURL;k.handleOpenURL=function(a){0==a.toLowerCase().indexOf(M("BuildInfo.packageName",k).toLowerCase()+
"://")&&f({url:a});if("function"===typeof g)try{g(a)}catch(n){console.error(n)}};b(null,f)};$i.prototype.fb=function(a){this.sa.push(a);dj(this).f(function(b){"auth/invalid-cordova-configuration"===b.code&&(b=new hg("unknown",null,null,null,new O("no-auth-event")),a(b))})};$i.prototype.$b=function(a){Za(this.sa,function(b){return b==a})};var hj=function(a){this.j=a;this.h=Ri()},ij={name:"pendingRedirect",B:"session"},jj=function(a){return a.h.set(ij,"pending",a.j)},kj=function(a){return a.h.remove(ij,a.j)},lj=function(a){return a.h.get(ij,a.j).then(function(a){return"pending"==a})};var pj=function(a,b,c){this.C=a;this.o=b;this.u=c;this.ec=[];this.ob=!1;this.cd=r(this.qd,this);this.Va=new mj(this);this.Id=new nj(this);this.Tb=new hj(this.o+":"+this.u);this.Fa={};this.Fa.unknown=this.Va;this.Fa.signInViaRedirect=this.Va;this.Fa.linkViaRedirect=this.Va;this.Fa.reauthViaRedirect=this.Va;this.Fa.signInViaPopup=this.Id;this.Fa.linkViaPopup=this.Id;this.Fa.reauthViaPopup=this.Id;this.X=oj(this.C,this.o,this.u)},oj=function(a,b,c){var d=firebase.SDK_VERSION||null;return zf()?new $i(a,
b,c,d):new Th(a,b,c,d)};pj.prototype.reset=function(){this.ob=!1;this.X.$b(this.cd);this.X=oj(this.C,this.o,this.u)};pj.prototype.Ob=function(){var a=this;this.ob||(this.ob=!0,this.X.fb(this.cd));var b=this.X;return this.X.Pa().f(function(c){a.X==b&&a.reset();throw c;})};var sj=function(a){a.X.Oe()&&a.Ob().f(function(b){var c=new hg("unknown",null,null,null,new O("operation-not-supported-in-this-environment"));qj(b)&&a.qd(c)});a.X.se()||rj(a.Va)};
pj.prototype.subscribe=function(a){Wa(this.ec,a)||this.ec.push(a);if(!this.ob){var b=this;lj(this.Tb).then(function(a){a?kj(b.Tb).then(function(){b.Ob().f(function(a){var c=new hg("unknown",null,null,null,new O("operation-not-supported-in-this-environment"));qj(a)&&b.qd(c)})}):sj(b)}).f(function(){sj(b)})}};pj.prototype.unsubscribe=function(a){Za(this.ec,function(b){return b==a})};
pj.prototype.qd=function(a){if(!a)throw new O("invalid-auth-event");for(var b=!1,c=0;c<this.ec.length;c++){var d=this.ec[c];if(d.de(a.la,a.U)){(b=this.Fa[a.la])&&b.Ie(a,d);b=!0;break}}rj(this.Va);return b};var tj=new Rf(2E3,1E4),uj=new Rf(3E4,6E4);pj.prototype.getRedirectResult=function(){return this.Va.getRedirectResult()};pj.prototype.Wb=function(a,b,c,d,e){var f=this;return this.X.Wb(a,b,c,function(){f.ob||(f.ob=!0,f.X.fb(f.cd))},function(){f.reset()},d,e)};
var qj=function(a){return a&&"auth/cordova-not-ready"==a.code?!0:!1};pj.prototype.Xb=function(a,b,c){var d=this,e;return jj(this.Tb).then(function(){return d.X.Xb(a,b,c).f(function(a){if(qj(a))throw new O("operation-not-supported-in-this-environment");e=a;return kj(d.Tb).then(function(){throw e;})}).then(function(){return d.X.Se()?new D(function(){}):kj(d.Tb).then(function(){return d.getRedirectResult()}).then(function(){}).f(function(){})})})};
pj.prototype.cc=function(a,b,c,d){return this.X.cc(c,function(c){a.Za(b,null,c,d)},tj.get())};var vj={},wj=function(a,b,c){var d=b+":"+c;vj[d]||(vj[d]=new pj(a,b,c));return vj[d]},mj=function(a){this.h=a;this.xb=null;this.Zb=[];this.Yb=[];this.ub=null;this.Ld=!1};mj.prototype.reset=function(){this.xb=null;this.ub&&(this.ub.cancel(),this.ub=null)};
mj.prototype.Ie=function(a,b){if(!a)return F(new O("invalid-auth-event"));this.reset();this.Ld=!0;var c=a.la,d=a.U,e=a.getError()&&"auth/web-storage-unsupported"==a.getError().code,f=a.getError()&&"auth/operation-not-supported-in-this-environment"==a.getError().code;"unknown"!=c||e||f?a=a.$?this.Jd(a,b):b.Jb(c,d)?this.Kd(a,b):F(new O("invalid-auth-event")):(xj(this,!1,null,null),a=E());return a};var rj=function(a){a.Ld||(a.Ld=!0,xj(a,!1,null,null))};
mj.prototype.Jd=function(a){xj(this,!0,null,a.getError());return E()};mj.prototype.Kd=function(a,b){var c=this;b=b.Jb(a.la,a.U);var d=a.Ab,e=a.sc(),f=!!a.la.match(/Redirect$/);return b(d,e).then(function(a){xj(c,f,a,null)}).f(function(a){xj(c,f,null,a)})};
var yj=function(a,b){a.xb=function(){return F(b)};if(a.Yb.length)for(var c=0;c<a.Yb.length;c++)a.Yb[c](b)},zj=function(a,b){a.xb=function(){return E(b)};if(a.Zb.length)for(var c=0;c<a.Zb.length;c++)a.Zb[c](b)},xj=function(a,b,c,d){b?d?yj(a,d):zj(a,c):zj(a,{user:null});a.Zb=[];a.Yb=[]};mj.prototype.getRedirectResult=function(){var a=this;return new D(function(b,c){a.xb?a.xb().then(b,c):(a.Zb.push(b),a.Yb.push(c),Aj(a))})};
var Aj=function(a){var b=new O("timeout");a.ub&&a.ub.cancel();a.ub=Be(uj.get()).then(function(){a.xb||xj(a,!0,null,b)})},nj=function(a){this.h=a};nj.prototype.Ie=function(a,b){if(!a)return F(new O("invalid-auth-event"));var c=a.la,d=a.U;return a.$?this.Jd(a,b):b.Jb(c,d)?this.Kd(a,b):F(new O("invalid-auth-event"))};nj.prototype.Jd=function(a,b){b.Za(a.la,null,a.getError(),a.U);return E()};
nj.prototype.Kd=function(a,b){var c=a.U,d=a.la,e=b.Jb(d,c),f=a.Ab;a=a.sc();return e(f,a).then(function(a){b.Za(d,a,null,c)}).f(function(a){b.Za(d,null,a,c)})};var Bj=function(a){this.g=a;this.Ga=this.da=null;this.La=0};Bj.prototype.I=function(){return{apiKey:this.g.o,refreshToken:this.da,accessToken:this.Ga,expirationTime:this.La}};
var Dj=function(a,b){var c=b.idToken,d=b.refreshToken;b=Cj(b.expiresIn);a.Ga=c;a.La=b;a.da=d},Cj=function(a){return na()+1E3*parseInt(a,10)},Ej=function(a,b){return ah(a.g,b).then(function(b){a.Ga=b.access_token;a.La=Cj(b.expires_in);a.da=b.refresh_token;return{accessToken:a.Ga,expirationTime:a.La,refreshToken:a.da}}).f(function(b){"auth/user-token-expired"==b.code&&(a.da=null);throw b;})};
Bj.prototype.getToken=function(a){a=!!a;return this.Ga&&!this.da?F(new O("user-token-expired")):a||!this.Ga||na()>this.La-3E4?this.da?Ej(this,{grant_type:"refresh_token",refresh_token:this.da}):E(null):E({accessToken:this.Ga,expirationTime:this.La,refreshToken:this.da})};var Fj=function(a,b,c,d,e,f){Xf(this,{uid:a,displayName:d||null,photoURL:e||null,email:c||null,phoneNumber:f||null,providerId:b})},Gj=function(a,b){B.call(this,a);for(var c in b)this[c]=b[c]};t(Gj,B);
var S=function(a,b,c){this.K=[];this.o=a.apiKey;this.u=a.appName;this.C=a.authDomain||null;a=firebase.SDK_VERSION?Ff(firebase.SDK_VERSION):null;this.g=new R(this.o,null,a);this.qa=new Bj(this.g);Hj(this,b.idToken);Dj(this.qa,b);N(this,"refreshToken",this.qa.da);Ij(this,c||{});G.call(this);this.Jc=!1;this.C&&Jf()&&(this.v=wj(this.C,this.o,this.u));this.Pc=[];this.ra=null;this.sb=Jj(this);this.Cb=r(this.rd,this);var d=this;this.ha=null;this.Ee=function(a){d.bc(a.Nf)};this.xd=null};t(S,G);
S.prototype.bc=function(a){this.ha=a;Vg(this.g,a)};var Kj=function(a,b){a.xd&&sc(a.xd,"languageCodeChanged",a.Ee);(a.xd=b)&&kc(b,"languageCodeChanged",a.Ee)};S.prototype.rd=function(){this.sb.qb&&(this.sb.stop(),this.sb.start())};
var Lj=function(a){try{return firebase.app(a.u).auth()}catch(b){throw new O("internal-error","No firebase.auth.Auth instance is available for the Firebase App '"+a.u+"'!");}},Jj=function(a){return new Ei(function(){return a.getIdToken(!0)},function(a){return a&&"auth/network-request-failed"==a.code?!0:!1},function(){var b=a.qa.La-na()-3E5;return 0<b?b:0},3E4,96E4,!1)},Mj=function(a){a.Gb||a.sb.qb||(a.sb.start(),sc(a,"tokenChanged",a.Cb),kc(a,"tokenChanged",a.Cb))},Nj=function(a){sc(a,"tokenChanged",
a.Cb);a.sb.stop()},Hj=function(a,b){a.ze=b;N(a,"_lat",b)},Oj=function(a,b){Za(a.Pc,function(a){return a==b})},Pj=function(a){for(var b=[],c=0;c<a.Pc.length;c++)b.push(a.Pc[c](a));return Bd(b).then(function(){return a})},Qj=function(a){a.v&&!a.Jc&&(a.Jc=!0,a.v.subscribe(a))},Ij=function(a,b){Xf(a,{uid:b.uid,displayName:b.displayName||null,photoURL:b.photoURL||null,email:b.email||null,emailVerified:b.emailVerified||!1,phoneNumber:b.phoneNumber||null,isAnonymous:b.isAnonymous||!1,providerData:[]})};
N(S.prototype,"providerId","firebase");var Rj=function(){},Sj=function(a){return E().then(function(){if(a.Gb)throw new O("app-deleted");})},Tj=function(a){return Sa(a.providerData,function(a){return a.providerId})},Vj=function(a,b){b&&(Uj(a,b.providerId),a.providerData.push(b))},Uj=function(a,b){Za(a.providerData,function(a){return a.providerId==b})},Wj=function(a,b,c){("uid"!=b||c)&&a.hasOwnProperty(b)&&N(a,b,c)};
S.prototype.copy=function(a){var b=this;b!=a&&(Xf(this,{uid:a.uid,displayName:a.displayName,photoURL:a.photoURL,email:a.email,emailVerified:a.emailVerified,phoneNumber:a.phoneNumber,isAnonymous:a.isAnonymous,providerData:[]}),x(a.providerData,function(a){Vj(b,a)}),this.qa=a.qa,N(this,"refreshToken",this.qa.da))};S.prototype.reload=function(){var a=this;return this.c(Sj(this).then(function(){return Xj(a).then(function(){return Pj(a)}).then(Rj)}))};
var Xj=function(a){return a.getIdToken().then(function(b){var c=a.isAnonymous;return Yj(a,b).then(function(){c||Wj(a,"isAnonymous",!1);return b})})};S.prototype.getIdToken=function(a){var b=this;return this.c(Sj(this).then(function(){return b.qa.getToken(a)}).then(function(a){if(!a)throw new O("internal-error");a.accessToken!=b.ze&&(Hj(b,a.accessToken),b.Ra());Wj(b,"refreshToken",a.refreshToken);return a.accessToken}))};
S.prototype.getToken=function(a){Uf["firebase.User.prototype.getToken is deprecated. Please use firebase.User.prototype.getIdToken instead."]||(Uf["firebase.User.prototype.getToken is deprecated. Please use firebase.User.prototype.getIdToken instead."]=!0,"undefined"!==typeof console&&"function"===typeof console.warn&&console.warn("firebase.User.prototype.getToken is deprecated. Please use firebase.User.prototype.getIdToken instead."));return this.getIdToken(a)};
var Zj=function(a,b){b.idToken&&a.ze!=b.idToken&&(Dj(a.qa,b),a.Ra(),Hj(a,b.idToken),Wj(a,"refreshToken",a.qa.da))};S.prototype.Ra=function(){this.dispatchEvent(new Gj("tokenChanged"))};var Yj=function(a,b){return Q(a.g,Dh,{idToken:b}).then(r(a.Xf,a))};
S.prototype.Xf=function(a){a=a.users;if(!a||!a.length)throw new O("internal-error");a=a[0];Ij(this,{uid:a.localId,displayName:a.displayName,photoURL:a.photoUrl,email:a.email,emailVerified:!!a.emailVerified,phoneNumber:a.phoneNumber});for(var b=ak(a),c=0;c<b.length;c++)Vj(this,b[c]);Wj(this,"isAnonymous",!(this.email&&a.passwordHash)&&!(this.providerData&&this.providerData.length))};
var ak=function(a){return(a=a.providerUserInfo)&&a.length?Sa(a,function(a){return new Fj(a.rawId,a.providerId,a.email,a.displayName,a.photoUrl,a.phoneNumber)}):[]};S.prototype.reauthenticateAndRetrieveDataWithCredential=function(a){var b=this,c=null;return this.c(a.Ad(this.g,this.uid).then(function(a){Zj(b,a);c=bk(b,a,"reauthenticate");b.ra=null;return b.reload()}).then(function(){return c}),!0)};S.prototype.reauthenticateWithCredential=function(a){return this.reauthenticateAndRetrieveDataWithCredential(a).then(function(){})};
var ck=function(a,b){return Xj(a).then(function(){if(Wa(Tj(a),b))return Pj(a).then(function(){throw new O("provider-already-linked");})})};S.prototype.linkAndRetrieveDataWithCredential=function(a){var b=this,c=null;return this.c(ck(this,a.providerId).then(function(){return b.getIdToken()}).then(function(c){return a.Ec(b.g,c)}).then(function(a){c=bk(b,a,"link");return dk(b,a)}).then(function(){return c}))};S.prototype.linkWithCredential=function(a){return this.linkAndRetrieveDataWithCredential(a).then(function(a){return a.user})};
S.prototype.linkWithPhoneNumber=function(a,b){var c=this;return this.c(ck(this,"phone").then(function(){return Ci(Lj(c),a,b,r(c.linkAndRetrieveDataWithCredential,c))}))};S.prototype.reauthenticateWithPhoneNumber=function(a,b){var c=this;return this.c(E().then(function(){return Ci(Lj(c),a,b,r(c.reauthenticateAndRetrieveDataWithCredential,c))}),!0)};var bk=function(a,b,c){var d=Lg(b);b=Mi(b);return Yf({user:a,credential:d,additionalUserInfo:b,operationType:c})},dk=function(a,b){Zj(a,b);return a.reload().then(function(){return a})};
h=S.prototype;h.updateEmail=function(a){var b=this;return this.c(this.getIdToken().then(function(c){return b.g.updateEmail(c,a)}).then(function(a){Zj(b,a);return b.reload()}))};h.updatePhoneNumber=function(a){var b=this;return this.c(this.getIdToken().then(function(c){return a.Ec(b.g,c)}).then(function(a){Zj(b,a);return b.reload()}))};h.updatePassword=function(a){var b=this;return this.c(this.getIdToken().then(function(c){return b.g.updatePassword(c,a)}).then(function(a){Zj(b,a);return b.reload()}))};
h.updateProfile=function(a){if(void 0===a.displayName&&void 0===a.photoURL)return Sj(this);var b=this;return this.c(this.getIdToken().then(function(c){return b.g.updateProfile(c,{displayName:a.displayName,photoUrl:a.photoURL})}).then(function(a){Zj(b,a);Wj(b,"displayName",a.displayName||null);Wj(b,"photoURL",a.photoUrl||null);x(b.providerData,function(a){"password"===a.providerId&&(N(a,"displayName",b.displayName),N(a,"photoURL",b.photoURL))});return Pj(b)}).then(Rj))};
h.unlink=function(a){var b=this;return this.c(Xj(this).then(function(c){return Wa(Tj(b),a)?rh(b.g,c,[a]).then(function(a){var c={};x(a.providerUserInfo||[],function(a){c[a.providerId]=!0});x(Tj(b),function(a){c[a]||Uj(b,a)});c[Ig.PROVIDER_ID]||N(b,"phoneNumber",null);return Pj(b)}):Pj(b).then(function(){throw new O("no-such-provider");})}))};
h["delete"]=function(){var a=this;return this.c(this.getIdToken().then(function(b){return Q(a.g,Ch,{idToken:b})}).then(function(){a.dispatchEvent(new Gj("userDeleted"))})).then(function(){for(var b=0;b<a.K.length;b++)a.K[b].cancel("app-deleted");Kj(a,null);a.K=[];a.Gb=!0;Nj(a);N(a,"refreshToken",null);a.v&&a.v.unsubscribe(a)})};
h.de=function(a,b){return"linkViaPopup"==a&&(this.ka||null)==b&&this.ja||"reauthViaPopup"==a&&(this.ka||null)==b&&this.ja||"linkViaRedirect"==a&&(this.Ea||null)==b||"reauthViaRedirect"==a&&(this.Ea||null)==b?!0:!1};h.Za=function(a,b,c,d){"linkViaPopup"!=a&&"reauthViaPopup"!=a||d!=(this.ka||null)||(c&&this.Ta?this.Ta(c):b&&!c&&this.ja&&this.ja(b),this.M&&(this.M.cancel(),this.M=null),delete this.ja,delete this.Ta)};
h.Jb=function(a,b){return"linkViaPopup"==a&&b==(this.ka||null)?r(this.me,this):"reauthViaPopup"==a&&b==(this.ka||null)?r(this.ne,this):"linkViaRedirect"==a&&(this.Ea||null)==b?r(this.me,this):"reauthViaRedirect"==a&&(this.Ea||null)==b?r(this.ne,this):null};h.rc=function(){return Gf(this.uid+":::")};h.linkWithPopup=function(a){var b=this;return ek(this,"linkViaPopup",a,function(){return ck(b,a.providerId).then(function(){return Pj(b)})},!1)};
h.reauthenticateWithPopup=function(a){return ek(this,"reauthViaPopup",a,function(){return E()},!0)};
var ek=function(a,b,c,d,e){if(!Jf())return F(new O("operation-not-supported-in-this-environment"));if(a.ra&&!e)return F(a.ra);var f=eg(c.providerId),g=a.rc(),l=null;(!Kf()||Cf())&&a.C&&c.isOAuthProvider&&(l=Xh(a.C,a.o,a.u,b,c,null,g,firebase.SDK_VERSION||null));var n=vf(l,f&&f.Vb,f&&f.Ub);d=d().then(function(){fk(a);if(!e)return a.getIdToken().then(function(){})}).then(function(){return a.v.Wb(n,b,c,g,!!l)}).then(function(){return new D(function(c,d){a.Za(b,null,new O("cancelled-popup-request"),a.ka||
null);a.ja=c;a.Ta=d;a.ka=g;a.M=a.v.cc(a,b,n,g)})}).then(function(a){n&&uf(n);return a?Yf(a):null}).f(function(a){n&&uf(n);throw a;});return a.c(d,e)};S.prototype.linkWithRedirect=function(a){var b=this;return gk(this,"linkViaRedirect",a,function(){return ck(b,a.providerId)},!1)};S.prototype.reauthenticateWithRedirect=function(a){return gk(this,"reauthViaRedirect",a,function(){return E()},!0)};
var gk=function(a,b,c,d,e){if(!Jf())return F(new O("operation-not-supported-in-this-environment"));if(a.ra&&!e)return F(a.ra);var f=null,g=a.rc();d=d().then(function(){fk(a);if(!e)return a.getIdToken().then(function(){})}).then(function(){a.Ea=g;return Pj(a)}).then(function(b){a.Wa&&(b=a.Wa,b=b.h.set(hk,a.I(),b.j));return b}).then(function(){return a.v.Xb(b,c,g)}).f(function(b){f=b;if(a.Wa)return ik(a.Wa);throw f;}).then(function(){if(f)throw f;});return a.c(d,e)},fk=function(a){if(!a.v||!a.Jc){if(a.v&&
!a.Jc)throw new O("internal-error");throw new O("auth-domain-config-required");}};S.prototype.me=function(a,b){var c=this;this.M&&(this.M.cancel(),this.M=null);var d=null,e=this.getIdToken().then(function(d){return pg(c.g,{requestUri:a,sessionId:b,idToken:d})}).then(function(a){d=bk(c,a,"link");return dk(c,a)}).then(function(){return d});return this.c(e)};
S.prototype.ne=function(a,b){var c=this;this.M&&(this.M.cancel(),this.M=null);var d=null,e=E().then(function(){return lg(qg(c.g,{requestUri:a,sessionId:b}),c.uid)}).then(function(a){d=bk(c,a,"reauthenticate");Zj(c,a);c.ra=null;return c.reload()}).then(function(){return d});return this.c(e,!0)};
S.prototype.sendEmailVerification=function(a){var b=this,c=null;return this.c(this.getIdToken().then(function(b){c=b;return"undefined"===typeof a||jb(a)?{}:Ai(new zi(a))}).then(function(a){return b.g.sendEmailVerification(c,a)}).then(function(a){if(b.email!=a)return b.reload()}).then(function(){}))};S.prototype.c=function(a,b){var c=this,d=jk(this,a,b);this.K.push(d);Ed(d,function(){Ya(c.K,d)});return d};
var jk=function(a,b,c){return a.ra&&!c?(b.cancel(),F(a.ra)):b.f(function(b){!b||"auth/user-disabled"!=b.code&&"auth/user-token-expired"!=b.code||(a.ra||a.dispatchEvent(new Gj("userInvalidated")),a.ra=b);throw b;})};S.prototype.toJSON=function(){return this.I()};
S.prototype.I=function(){var a={uid:this.uid,displayName:this.displayName,photoURL:this.photoURL,email:this.email,emailVerified:this.emailVerified,phoneNumber:this.phoneNumber,isAnonymous:this.isAnonymous,providerData:[],apiKey:this.o,appName:this.u,authDomain:this.C,stsTokenManager:this.qa.I(),redirectEventId:this.Ea||null};x(this.providerData,function(b){a.providerData.push(Zf(b))});return a};
var kk=function(a){if(!a.apiKey)return null;var b={apiKey:a.apiKey,authDomain:a.authDomain,appName:a.appName},c={};if(a.stsTokenManager&&a.stsTokenManager.accessToken&&a.stsTokenManager.expirationTime)c.idToken=a.stsTokenManager.accessToken,c.refreshToken=a.stsTokenManager.refreshToken||null,c.expiresIn=(a.stsTokenManager.expirationTime-na())/1E3;else return null;var d=new S(b,c,a);a.providerData&&x(a.providerData,function(a){a&&Vj(d,Yf(a))});a.redirectEventId&&(d.Ea=a.redirectEventId);return d},
lk=function(a,b,c){var d=new S(a,b);c&&(d.Wa=c);return d.reload().then(function(){return d})};var mk=function(a){this.j=a;this.h=Ri()},hk={name:"redirectUser",B:"session"},ik=function(a){return a.h.remove(hk,a.j)},nk=function(a,b){return a.h.get(hk,a.j).then(function(a){a&&b&&(a.authDomain=b);return kk(a||{})})};var pk=function(a,b){this.j=a;this.h=b||Ri();this.N=null;this.Dd=this.vd();this.h.addListener(ok("local"),this.j,r(this.mg,this))};pk.prototype.mg=function(){var a=this,b=ok("local");qk(this,function(){return E().then(function(){return a.N&&"local"!=a.N.B?a.h.get(b,a.j):null}).then(function(c){if(c)return rk(a,"local").then(function(){a.N=b})})})};var rk=function(a,b){var c=[],d;for(d in Ni)Ni[d]!==b&&c.push(a.h.remove(ok(Ni[d]),a.j));c.push(a.h.remove(sk,a.j));return Ad(c)};
pk.prototype.vd=function(){var a=this,b=ok("local"),c=ok("session"),d=ok("none");return this.h.get(c,this.j).then(function(e){return e?c:a.h.get(d,a.j).then(function(c){return c?d:a.h.get(b,a.j).then(function(c){return c?b:a.h.get(sk,a.j).then(function(a){return a?ok(a):b})})})}).then(function(b){a.N=b;return rk(a,b.B)}).f(function(){a.N||(a.N=b)})};var sk={name:"persistence",B:"session"},ok=function(a){return{name:"authUser",B:a}};
pk.prototype.Sd=function(a){var b=null,c=this;Oi(a);return qk(this,function(){return a!=c.N.B?c.h.get(c.N,c.j).then(function(d){b=d;return rk(c,a)}).then(function(){c.N=ok(a);if(b)return c.h.set(c.N,b,c.j)}):E()})};
var tk=function(a){return qk(a,function(){return a.h.set(sk,a.N.B,a.j)})},uk=function(a,b){return qk(a,function(){return a.h.set(a.N,b.I(),a.j)})},vk=function(a){return qk(a,function(){return a.h.remove(a.N,a.j)})},wk=function(a,b){return qk(a,function(){return a.h.get(a.N,a.j).then(function(a){a&&b&&(a.authDomain=b);return kk(a||{})})})},qk=function(a,b){a.Dd=a.Dd.then(b,b);return a.Dd};var T=function(a){this.Ba=!1;N(this,"app",a);if(this.i().options&&this.i().options.apiKey)a=firebase.SDK_VERSION?Ff(firebase.SDK_VERSION):null,this.g=new R(this.i().options&&this.i().options.apiKey,null,a);else throw new O("invalid-api-key");this.K=[];this.Ha=[];this.Bb=[];this.Tf=firebase.INTERNAL.createSubscribe(r(this.Hf,this));this.jc=void 0;this.Vf=firebase.INTERNAL.createSubscribe(r(this.Jf,this));xk(this,null);a=this.i().options.apiKey;var b=this.i().name;this.ma=new pk(a+":"+b);a=this.i().options.apiKey;
b=this.i().name;this.vb=new mk(a+":"+b);this.mc=this.c(yk(this));this.xa=this.c(zk(this));this.Bc=!1;this.pd=r(this.ng,this);this.Ve=r(this.lb,this);this.Cb=r(this.rd,this);this.Te=r(this.Cf,this);this.Ue=r(this.Df,this);Ak(this);this.INTERNAL={};this.INTERNAL["delete"]=r(this["delete"],this);this.Ma=0;G.call(this);Bk(this)};t(T,G);var Ck=function(a){B.call(this,"languageCodeChanged");this.Nf=a};t(Ck,B);T.prototype.Sd=function(a){a=this.ma.Sd(a);return this.c(a)};
T.prototype.bc=function(a){this.ha===a||this.Ba||(this.ha=a,Vg(this.g,this.ha),this.dispatchEvent(new Ck(this.ha)))};var Bk=function(a){Object.defineProperty(a,"lc",{get:function(){return this.ha},set:function(a){this.bc(a)},enumerable:!1});a.ha=null};T.prototype.toJSON=function(){return{apiKey:this.i().options.apiKey,authDomain:this.i().options.authDomain,appName:this.i().name,currentUser:U(this)&&U(this).I()}};
var Dk=function(a){return a.pf||F(new O("auth-domain-config-required"))},Ak=function(a){var b=a.i().options.authDomain,c=a.i().options.apiKey;b&&Jf()&&(a.pf=a.mc.then(function(){if(!a.Ba){a.v=wj(b,c,a.i().name);a.v.subscribe(a);U(a)&&Qj(U(a));if(a.wb){Qj(a.wb);var d=a.wb;d.bc(a.ha);Kj(d,a);a.wb=null}return a.v}}))};h=T.prototype;h.de=function(a,b){switch(a){case "unknown":case "signInViaRedirect":return!0;case "signInViaPopup":return this.ka==b&&!!this.ja;default:return!1}};
h.Za=function(a,b,c,d){"signInViaPopup"==a&&this.ka==d&&(c&&this.Ta?this.Ta(c):b&&!c&&this.ja&&this.ja(b),this.M&&(this.M.cancel(),this.M=null),delete this.ja,delete this.Ta)};h.Jb=function(a,b){return"signInViaRedirect"==a||"signInViaPopup"==a&&this.ka==b&&this.ja?r(this.rf,this):null};
h.rf=function(a,b){var c=this;a={requestUri:a,sessionId:b};this.M&&(this.M.cancel(),this.M=null);var d=null,e=null,f=ng(c.g,a).then(function(a){d=Lg(a);e=Mi(a);return a});a=c.mc.then(function(){return f}).then(function(a){return Ek(c,a)}).then(function(){return Yf({user:U(c),credential:d,additionalUserInfo:e,operationType:"signIn"})});return this.c(a)};h.rc=function(){return Gf()};
h.signInWithPopup=function(a){if(!Jf())return F(new O("operation-not-supported-in-this-environment"));var b=this,c=eg(a.providerId),d=this.rc(),e=null;(!Kf()||Cf())&&this.i().options.authDomain&&a.isOAuthProvider&&(e=Xh(this.i().options.authDomain,this.i().options.apiKey,this.i().name,"signInViaPopup",a,null,d,firebase.SDK_VERSION||null));var f=vf(e,c&&c.Vb,c&&c.Ub);c=Dk(this).then(function(b){return b.Wb(f,"signInViaPopup",a,d,!!e)}).then(function(){return new D(function(a,c){b.Za("signInViaPopup",
null,new O("cancelled-popup-request"),b.ka);b.ja=a;b.Ta=c;b.ka=d;b.M=b.v.cc(b,"signInViaPopup",f,d)})}).then(function(a){f&&uf(f);return a?Yf(a):null}).f(function(a){f&&uf(f);throw a;});return this.c(c)};h.signInWithRedirect=function(a){if(!Jf())return F(new O("operation-not-supported-in-this-environment"));var b=this,c=Dk(this).then(function(){return tk(b.ma)}).then(function(){return b.v.Xb("signInViaRedirect",a)});return this.c(c)};
h.getRedirectResult=function(){if(!Jf())return F(new O("operation-not-supported-in-this-environment"));var a=this,b=Dk(this).then(function(){return a.v.getRedirectResult()}).then(function(a){return a?Yf(a):null});return this.c(b)};
var Ek=function(a,b){var c={};c.apiKey=a.i().options.apiKey;c.authDomain=a.i().options.authDomain;c.appName=a.i().name;return a.mc.then(function(){return lk(c,b,a.vb)}).then(function(b){if(U(a)&&b.uid==U(a).uid)return U(a).copy(b),a.lb(b);xk(a,b);Qj(b);return a.lb(b)}).then(function(){a.Ra()})},xk=function(a,b){U(a)&&(Oj(U(a),a.Ve),sc(U(a),"tokenChanged",a.Cb),sc(U(a),"userDeleted",a.Te),sc(U(a),"userInvalidated",a.Ue),Nj(U(a)));b&&(b.Pc.push(a.Ve),kc(b,"tokenChanged",a.Cb),kc(b,"userDeleted",a.Te),
kc(b,"userInvalidated",a.Ue),0<a.Ma&&Mj(b));N(a,"currentUser",b);b&&(b.bc(a.ha),Kj(b,a))};T.prototype.signOut=function(){var a=this,b=this.xa.then(function(){if(!U(a))return E();xk(a,null);return vk(a.ma).then(function(){a.Ra()})});return this.c(b)};
var Fk=function(a){var b=a.i().options.authDomain;b=nk(a.vb,b).then(function(b){if(a.wb=b)b.Wa=a.vb;return ik(a.vb)});return a.c(b)},yk=function(a){var b=a.i().options.authDomain,c=Fk(a).then(function(){return wk(a.ma,b)}).then(function(b){return b?(b.Wa=a.vb,a.wb&&(a.wb.Ea||null)==(b.Ea||null)?b:b.reload().then(function(){return uk(a.ma,b).then(function(){return b})}).f(function(c){return"auth/network-request-failed"==c.code?b:vk(a.ma)})):null}).then(function(b){xk(a,b||null)});return a.c(c)},zk=
function(a){return a.mc.then(function(){return a.getRedirectResult()}).f(function(){}).then(function(){if(!a.Ba)return a.pd()}).f(function(){}).then(function(){if(!a.Ba){a.Bc=!0;var b=a.ma;b.h.addListener(ok("local"),b.j,a.pd)}})};h=T.prototype;
h.ng=function(){var a=this,b=this.i().options.authDomain;return wk(this.ma,b).then(function(b){if(!a.Ba){var c;if(c=U(a)&&b){c=U(a).uid;var e=b.uid;c=void 0===c||null===c||""===c||void 0===e||null===e||""===e?!1:c==e}if(c)return U(a).copy(b),U(a).getIdToken();if(U(a)||b)xk(a,b),b&&(Qj(b),b.Wa=a.vb),a.v&&a.v.subscribe(a),a.Ra()}})};h.lb=function(a){return uk(this.ma,a)};h.rd=function(){this.Ra();this.lb(U(this))};h.Cf=function(){this.signOut()};h.Df=function(){this.signOut()};
var Gk=function(a,b){var c=null,d=null;return a.c(b.then(function(b){c=Lg(b);d=Mi(b);return Ek(a,b)}).then(function(){return Yf({user:U(a),credential:c,additionalUserInfo:d,operationType:"signIn"})}))};h=T.prototype;h.Hf=function(a){var b=this;this.addAuthTokenListener(function(){a.next(U(b))})};h.Jf=function(a){var b=this;Hk(this,function(){a.next(U(b))})};
h.onIdTokenChanged=function(a,b,c){var d=this;this.Bc&&firebase.Promise.resolve().then(function(){p(a)?a(U(d)):p(a.next)&&a.next(U(d))});return this.Tf(a,b,c)};h.onAuthStateChanged=function(a,b,c){var d=this;this.Bc&&firebase.Promise.resolve().then(function(){d.jc=d.getUid();p(a)?a(U(d)):p(a.next)&&a.next(U(d))});return this.Vf(a,b,c)};h.xf=function(a){var b=this,c=this.xa.then(function(){return U(b)?U(b).getIdToken(a).then(function(a){return{accessToken:a}}):null});return this.c(c)};
h.signInWithCustomToken=function(a){var b=this;return this.xa.then(function(){return Gk(b,Q(b.g,Fh,{token:a}))}).then(function(a){a=a.user;Wj(a,"isAnonymous",!1);return b.lb(a)}).then(function(){return U(b)})};h.signInWithEmailAndPassword=function(a,b){var c=this;return this.xa.then(function(){return Gk(c,Q(c.g,Bg,{email:a,password:b}))}).then(function(a){return a.user})};h.createUserWithEmailAndPassword=function(a,b){var c=this;return this.xa.then(function(){return Gk(c,Q(c.g,Bh,{email:a,password:b}))}).then(function(a){return a.user})};
h.signInWithCredential=function(a){return this.signInAndRetrieveDataWithCredential(a).then(function(a){return a.user})};h.signInAndRetrieveDataWithCredential=function(a){var b=this;return this.xa.then(function(){return Gk(b,a.Kb(b.g))})};h.signInAnonymously=function(){var a=this;return this.xa.then(function(){var b=U(a);return b&&b.isAnonymous?b:Gk(a,a.g.signInAnonymously()).then(function(b){b=b.user;Wj(b,"isAnonymous",!0);return a.lb(b)}).then(function(){return U(a)})})};h.i=function(){return this.app};
var U=function(a){return a.currentUser};T.prototype.getUid=function(){return U(this)&&U(this).uid||null};var Ik=function(a){return U(a)&&U(a)._lat||null};h=T.prototype;h.Ra=function(){if(this.Bc){for(var a=0;a<this.Ha.length;a++)if(this.Ha[a])this.Ha[a](Ik(this));if(this.jc!==this.getUid()&&this.Bb.length)for(this.jc=this.getUid(),a=0;a<this.Bb.length;a++)if(this.Bb[a])this.Bb[a](Ik(this))}};h.df=function(a){this.addAuthTokenListener(a);this.Ma++;0<this.Ma&&U(this)&&Mj(U(this))};
h.ag=function(a){var b=this;x(this.Ha,function(c){c==a&&b.Ma--});0>this.Ma&&(this.Ma=0);0==this.Ma&&U(this)&&Nj(U(this));this.removeAuthTokenListener(a)};h.addAuthTokenListener=function(a){var b=this;this.Ha.push(a);this.c(this.xa.then(function(){b.Ba||Wa(b.Ha,a)&&a(Ik(b))}))};h.removeAuthTokenListener=function(a){Za(this.Ha,function(b){return b==a})};var Hk=function(a,b){a.Bb.push(b);a.c(a.xa.then(function(){!a.Ba&&Wa(a.Bb,b)&&a.jc!==a.getUid()&&(a.jc=a.getUid(),b(Ik(a)))}))};h=T.prototype;
h["delete"]=function(){this.Ba=!0;for(var a=0;a<this.K.length;a++)this.K[a].cancel("app-deleted");this.K=[];this.ma&&(a=this.ma,a.h.removeListener(ok("local"),a.j,this.pd));this.v&&this.v.unsubscribe(this);return firebase.Promise.resolve()};h.c=function(a){var b=this;this.K.push(a);Ed(a,function(){Ya(b.K,a)});return a};h.fetchProvidersForEmail=function(a){return this.c(fh(this.g,a))};h.verifyPasswordResetCode=function(a){return this.checkActionCode(a).then(function(a){return a.data.email})};
h.confirmPasswordReset=function(a,b){return this.c(this.g.confirmPasswordReset(a,b).then(function(){}))};h.checkActionCode=function(a){return this.c(this.g.checkActionCode(a).then(function(a){return new Di(a)}))};h.applyActionCode=function(a){return this.c(this.g.applyActionCode(a).then(function(){}))};h.sendPasswordResetEmail=function(a,b){var c=this;return this.c(E().then(function(){return"undefined"===typeof b||jb(b)?{}:Ai(new zi(b))}).then(function(b){return c.g.sendPasswordResetEmail(a,b)}).then(function(){}))};
h.signInWithPhoneNumber=function(a,b){return this.c(Ci(this,a,b,r(this.signInAndRetrieveDataWithCredential,this)))};var Jk="First Second Third Fourth Fifth Sixth Seventh Eighth Ninth".split(" "),V=function(a,b){return{name:a||"",R:"a valid string",optional:!!b,S:m}},Kk=function(){return{name:"opt_forceRefresh",R:"a boolean",optional:!0,S:ca}},W=function(a,b){return{name:a||"",R:"a valid object",optional:!!b,S:q}},Lk=function(a,b){return{name:a||"",R:"a function",optional:!!b,S:p}},Mk=function(a,b){return{name:a||"",R:"null",optional:!!b,S:ha}},Nk=function(){return{name:"",R:"an HTML element",optional:!1,S:function(a){return!!(a&&
a instanceof Element)}}},Ok=function(){return{name:"auth",R:"an instance of Firebase Auth",optional:!0,S:function(a){return!!(a&&a instanceof T)}}},Pk=function(){return{name:"app",R:"an instance of Firebase App",optional:!0,S:function(a){return!!(a&&a instanceof firebase.app.App)}}},Qk=function(a){return{name:a?a+"Credential":"credential",R:a?"a valid "+a+" credential":"a valid credential",optional:!1,S:function(b){if(!b)return!1;var c=!a||b.providerId===a;return!(!b.Kb||!c)}}},Rk=function(){return{name:"authProvider",
R:"a valid Auth provider",optional:!1,S:function(a){return!!(a&&a.providerId&&a.hasOwnProperty&&a.hasOwnProperty("isOAuthProvider"))}}},Sk=function(){return{name:"applicationVerifier",R:"an implementation of firebase.auth.ApplicationVerifier",optional:!1,S:function(a){return!!(a&&m(a.type)&&p(a.verify))}}},X=function(a,b,c,d){return{name:c||"",R:a.R+" or "+b.R,optional:!!d,S:function(c){return a.S(c)||b.S(c)}}};var Y=function(a,b){for(var c in b){var d=b[c].name;a[d]=Tk(d,a[c],b[c].a)}},Z=function(a,b,c,d){a[b]=Tk(b,c,d)},Tk=function(a,b,c){if(!c)return b;var d=Uk(a);a=function(){var a=Array.prototype.slice.call(arguments);a:{var e=Array.prototype.slice.call(a);var l=0;for(var n=!1,C=0;C<c.length;C++)if(c[C].optional)n=!0;else{if(n)throw new O("internal-error","Argument validator encountered a required argument after an optional argument.");l++}n=c.length;if(e.length<l||n<e.length)e="Expected "+(l==n?1==
l?"1 argument":l+" arguments":l+"-"+n+" arguments")+" but got "+e.length+".";else{for(l=0;l<e.length;l++)if(n=c[l].optional&&void 0===e[l],!c[l].S(e[l])&&!n){e=c[l];if(0>l||l>=Jk.length)throw new O("internal-error","Argument validator received an unsupported number of arguments.");e=Jk[l]+" argument "+(e.name?'"'+e.name+'" ':"")+"must be "+e.R+".";break a}e=null}}if(e)throw new O("argument-error",d+" failed: "+e);return b.apply(this,a)};for(var e in b)a[e]=b[e];for(e in b.prototype)a.prototype[e]=
b.prototype[e];return a},Uk=function(a){a=a.split(".");return a[a.length-1]};Y(T.prototype,{applyActionCode:{name:"applyActionCode",a:[V("code")]},checkActionCode:{name:"checkActionCode",a:[V("code")]},confirmPasswordReset:{name:"confirmPasswordReset",a:[V("code"),V("newPassword")]},createUserWithEmailAndPassword:{name:"createUserWithEmailAndPassword",a:[V("email"),V("password")]},fetchProvidersForEmail:{name:"fetchProvidersForEmail",a:[V("email")]},getRedirectResult:{name:"getRedirectResult",a:[]},onAuthStateChanged:{name:"onAuthStateChanged",a:[X(W(),Lk(),"nextOrObserver"),
Lk("opt_error",!0),Lk("opt_completed",!0)]},onIdTokenChanged:{name:"onIdTokenChanged",a:[X(W(),Lk(),"nextOrObserver"),Lk("opt_error",!0),Lk("opt_completed",!0)]},sendPasswordResetEmail:{name:"sendPasswordResetEmail",a:[V("email"),X(W("opt_actionCodeSettings",!0),Mk(null,!0),"opt_actionCodeSettings",!0)]},Sd:{name:"setPersistence",a:[V("persistence")]},signInAndRetrieveDataWithCredential:{name:"signInAndRetrieveDataWithCredential",a:[Qk()]},signInAnonymously:{name:"signInAnonymously",a:[]},signInWithCredential:{name:"signInWithCredential",
a:[Qk()]},signInWithCustomToken:{name:"signInWithCustomToken",a:[V("token")]},signInWithEmailAndPassword:{name:"signInWithEmailAndPassword",a:[V("email"),V("password")]},signInWithPhoneNumber:{name:"signInWithPhoneNumber",a:[V("phoneNumber"),Sk()]},signInWithPopup:{name:"signInWithPopup",a:[Rk()]},signInWithRedirect:{name:"signInWithRedirect",a:[Rk()]},signOut:{name:"signOut",a:[]},toJSON:{name:"toJSON",a:[V(null,!0)]},verifyPasswordResetCode:{name:"verifyPasswordResetCode",a:[V("code")]}});
T.Persistence=Ni;T.Persistence.LOCAL="local";T.Persistence.SESSION="session";T.Persistence.NONE="none";
Y(S.prototype,{"delete":{name:"delete",a:[]},getIdToken:{name:"getIdToken",a:[Kk()]},getToken:{name:"getToken",a:[Kk()]},linkAndRetrieveDataWithCredential:{name:"linkAndRetrieveDataWithCredential",a:[Qk()]},linkWithCredential:{name:"linkWithCredential",a:[Qk()]},linkWithPhoneNumber:{name:"linkWithPhoneNumber",a:[V("phoneNumber"),Sk()]},linkWithPopup:{name:"linkWithPopup",a:[Rk()]},linkWithRedirect:{name:"linkWithRedirect",a:[Rk()]},reauthenticateAndRetrieveDataWithCredential:{name:"reauthenticateAndRetrieveDataWithCredential",
a:[Qk()]},reauthenticateWithCredential:{name:"reauthenticateWithCredential",a:[Qk()]},reauthenticateWithPhoneNumber:{name:"reauthenticateWithPhoneNumber",a:[V("phoneNumber"),Sk()]},reauthenticateWithPopup:{name:"reauthenticateWithPopup",a:[Rk()]},reauthenticateWithRedirect:{name:"reauthenticateWithRedirect",a:[Rk()]},reload:{name:"reload",a:[]},sendEmailVerification:{name:"sendEmailVerification",a:[X(W("opt_actionCodeSettings",!0),Mk(null,!0),"opt_actionCodeSettings",!0)]},toJSON:{name:"toJSON",a:[V(null,
!0)]},unlink:{name:"unlink",a:[V("provider")]},updateEmail:{name:"updateEmail",a:[V("email")]},updatePassword:{name:"updatePassword",a:[V("password")]},updatePhoneNumber:{name:"updatePhoneNumber",a:[Qk("phone")]},updateProfile:{name:"updateProfile",a:[W("profile")]}});Y(D.prototype,{f:{name:"catch"},then:{name:"then"}});Y(Bi.prototype,{confirm:{name:"confirm",a:[V("verificationCode")]}});Z(Dg,"credential",function(a,b){return new Ag(a,b)},[V("email"),V("password")]);
Y(sg.prototype,{addScope:{name:"addScope",a:[V("scope")]},setCustomParameters:{name:"setCustomParameters",a:[W("customOAuthParameters")]}});Z(sg,"credential",tg,[X(V(),W(),"token")]);Y(ug.prototype,{addScope:{name:"addScope",a:[V("scope")]},setCustomParameters:{name:"setCustomParameters",a:[W("customOAuthParameters")]}});Z(ug,"credential",vg,[X(V(),W(),"token")]);Y(wg.prototype,{addScope:{name:"addScope",a:[V("scope")]},setCustomParameters:{name:"setCustomParameters",a:[W("customOAuthParameters")]}});
Z(wg,"credential",xg,[X(V(),X(W(),Mk()),"idToken"),X(V(),Mk(),"accessToken",!0)]);Y(yg.prototype,{setCustomParameters:{name:"setCustomParameters",a:[W("customOAuthParameters")]}});Z(yg,"credential",zg,[X(V(),W(),"token"),V("secret",!0)]);Y(P.prototype,{addScope:{name:"addScope",a:[V("scope")]},credential:{name:"credential",a:[X(V(),Mk(),"idToken",!0),X(V(),Mk(),"accessToken",!0)]},setCustomParameters:{name:"setCustomParameters",a:[W("customOAuthParameters")]}});
Z(Ig,"credential",Kg,[V("verificationId"),V("verificationCode")]);Y(Ig.prototype,{verifyPhoneNumber:{name:"verifyPhoneNumber",a:[V("phoneNumber"),Sk()]}});Y(O.prototype,{toJSON:{name:"toJSON",a:[V(null,!0)]}});Y(Ng.prototype,{toJSON:{name:"toJSON",a:[V(null,!0)]}});Y(jg.prototype,{toJSON:{name:"toJSON",a:[V(null,!0)]}});Y(Yh.prototype,{clear:{name:"clear",a:[]},render:{name:"render",a:[]},verify:{name:"verify",a:[]}});
(function(){if("undefined"!==typeof firebase&&firebase.INTERNAL&&firebase.INTERNAL.registerService){var a={Auth:T,Error:O};Z(a,"EmailAuthProvider",Dg,[]);Z(a,"FacebookAuthProvider",sg,[]);Z(a,"GithubAuthProvider",ug,[]);Z(a,"GoogleAuthProvider",wg,[]);Z(a,"TwitterAuthProvider",yg,[]);Z(a,"OAuthProvider",P,[V("providerId")]);Z(a,"PhoneAuthProvider",Ig,[Ok()]);Z(a,"RecaptchaVerifier",Yh,[X(V(),Nk(),"recaptchaContainer"),W("recaptchaParameters",!0),Pk()]);firebase.INTERNAL.registerService("auth",function(a,
c){a=new T(a);c({INTERNAL:{getUid:r(a.getUid,a),getToken:r(a.xf,a),addAuthTokenListener:r(a.df,a),removeAuthTokenListener:r(a.ag,a)}});return a},a,function(a,c){if("create"===a)try{c.auth()}catch(d){}});firebase.INTERNAL.extendNamespace({User:S})}else throw Error("Cannot find the firebase namespace; be sure to include firebase-app.js before this library.");})();}).call(this);

try{webpackJsonpFirebase([0],[function(t,e,n){"use strict";n.d(e,"a",function(){return i}),n.d(e,"b",function(){return o});var r=n(7),i=function(t,e){if(!t)throw o(e)},o=function(t){return Error("Firebase Database ("+r.a.SDK_VERSION+") INTERNAL ASSERT FAILED: "+t)}},function(t,e,n){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=n(14),i=function(t){for(var e=[],n=0,r=0;r<t.length;r++){for(var i=t.charCodeAt(r);i>255;)e[n++]=255&i,i>>=8;e[n++]=i}return e},o=function(t){if(t.length<8192)return String.fromCharCode.apply(null,t);for(var e="",n=0;n<t.length;n+=8192){var r=t.slice(n,n+8192);e+=String.fromCharCode.apply(null,r)}return e},s={_:null,O:null,S:null,T:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:"function"==typeof r.a.atob,encodeByteArray:function(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.N();for(var n=e?this.S:this._,r=[],i=0;i<t.length;i+=3){var o=t[i],s=i+1<t.length,a=s?t[i+1]:0,u=i+2<t.length,c=u?t[i+2]:0,h=o>>2,l=(3&o)<<4|a>>4,p=(15&a)<<2|c>>6,d=63&c;u||(d=64,s||(p=64)),r.push(n[h],n[l],n[p],n[d])}return r.join("")},encodeString:function(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(i(t),e)},decodeString:function(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):o(this.decodeStringToByteArray(t,e))},decodeStringToByteArray:function(t,e){this.N();for(var n=e?this.T:this.O,r=[],i=0;i<t.length;){var o=n[t.charAt(i++)],s=i<t.length,a=s?n[t.charAt(i)]:0;++i;var u=i<t.length,c=u?n[t.charAt(i)]:64;++i;var h=i<t.length,l=h?n[t.charAt(i)]:64;if(++i,null==o||null==a||null==c||null==l)throw Error();var p=o<<2|a>>4;if(r.push(p),64!=c){var d=a<<4&240|c>>2;if(r.push(d),64!=l){var f=c<<6&192|l;r.push(f)}}}return r},N:function(){if(!this._){this._={},this.O={},this.S={},this.T={};for(var t=0;t<this.ENCODED_VALS.length;t++)this._[t]=this.ENCODED_VALS.charAt(t),this.O[this._[t]]=t,this.S[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.T[this.S[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.O[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.T[this.ENCODED_VALS.charAt(t)]=t)}}},a=function(){function t(){this.blockSize=-1}return t}(),u=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),c=function(t){function e(){var e=t.call(this)||this;e.P=[],e.R=[],e.D=[],e.F=[],e.L=0,e.M=0,e.blockSize=64,e.F[0]=128;for(var n=1;n<e.blockSize;++n)e.F[n]=0;return e.reset(),e}return u(e,t),e.prototype.reset=function(){this.P[0]=1732584193,this.P[1]=4023233417,this.P[2]=2562383102,this.P[3]=271733878,this.P[4]=3285377520,this.L=0,this.M=0},e.prototype.W=function(t,e){e||(e=0);var n=this.D;if("string"==typeof t)for(var r=0;r<16;r++)n[r]=t.charCodeAt(e)<<24|t.charCodeAt(e+1)<<16|t.charCodeAt(e+2)<<8|t.charCodeAt(e+3),e+=4;else for(var r=0;r<16;r++)n[r]=t[e]<<24|t[e+1]<<16|t[e+2]<<8|t[e+3],e+=4;for(var r=16;r<80;r++){var i=n[r-3]^n[r-8]^n[r-14]^n[r-16];n[r]=4294967295&(i<<1|i>>>31)}for(var o,s,a=this.P[0],u=this.P[1],c=this.P[2],h=this.P[3],l=this.P[4],r=0;r<80;r++){r<40?r<20?(o=h^u&(c^h),s=1518500249):(o=u^c^h,s=1859775393):r<60?(o=u&c|h&(u|c),s=2400959708):(o=u^c^h,s=3395469782);var i=(a<<5|a>>>27)+o+l+s+n[r]&4294967295;l=h,h=c,c=4294967295&(u<<30|u>>>2),u=a,a=i}this.P[0]=this.P[0]+a&4294967295,this.P[1]=this.P[1]+u&4294967295,this.P[2]=this.P[2]+c&4294967295,this.P[3]=this.P[3]+h&4294967295,this.P[4]=this.P[4]+l&4294967295},e.prototype.update=function(t,e){if(null!=t){void 0===e&&(e=t.length);for(var n=e-this.blockSize,r=0,i=this.R,o=this.L;r<e;){if(0==o)for(;r<=n;)this.W(t,r),r+=this.blockSize;if("string"==typeof t){for(;r<e;)if(i[o]=t.charCodeAt(r),++o,++r,o==this.blockSize){this.W(i),o=0;break}}else for(;r<e;)if(i[o]=t[r],++o,++r,o==this.blockSize){this.W(i),o=0;break}}this.L=o,this.M+=e}},e.prototype.digest=function(){var t=[],e=8*this.M;this.L<56?this.update(this.F,56-this.L):this.update(this.F,this.blockSize-(this.L-56));for(var n=this.blockSize-1;n>=56;n--)this.R[n]=255&e,e/=256;this.W(this.R);for(var r=0,n=0;n<5;n++)for(var i=24;i>=0;i-=8)t[r]=this.P[n]>>i&255,++r;return t},e}(a);n.d(e,"a",function(){return g}),n.d(e,"f",function(){return m}),n.d(e,"e",function(){return b}),n.d(e,"y",function(){return C}),n.d(e,"u",function(){return w}),n.d(e,"j",function(){return S}),n.d(e,"s",function(){return T}),n.d(e,"t",function(){return N}),n.d(e,"k",function(){return I}),n.d(e,"o",function(){return P}),n.d(e,"B",function(){return R}),n.d(e,"C",function(){return D}),n.d(e,"q",function(){return j}),n.d(e,"n",function(){return x}),n.d(e,"c",function(){return k}),n.d(e,"b",function(){return F}),n.d(e,"v",function(){return A}),n.d(e,"A",function(){return L}),n.d(e,"w",function(){return M}),n.d(e,"d",function(){return W}),n.d(e,"z",function(){return q}),n.d(e,"i",function(){return Q}),n.d(e,"h",function(){return U}),n.d(e,"p",function(){return V}),n.d(e,"r",function(){return B}),n.d(e,"l",function(){return H}),n.d(e,"m",function(){return z}),n.d(e,"g",function(){return G}),n.d(e,"x",function(){return X});var h,l=n(0),p=n(2),d=n(11),f=n(3),_=n(8),y=n(6),v="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},g=function(){var t=1;return function(){return t++}}(),m=function(t){var e=Object(d.b)(t);return s.encodeByteArray(e,!0)},b=function(t){try{return h?new h(t,"base64").toString("utf8"):s.decodeString(t,!0)}catch(t){T("base64Decode failed: ",t)}return null},C=function(t){var e=Object(d.b)(t),n=new c;n.update(e);var r=n.digest();return s.encodeByteArray(r)},E=function t(){for(var e=[],n=0;n<arguments.length;n++)e[n]=arguments[n];for(var r="",i=0;i<e.length;i++)Array.isArray(e[i])||e[i]&&"object"===v(e[i])&&"number"==typeof e[i].length?r+=t.apply(null,e[i]):"object"===v(e[i])?r+=Object(f.b)(e[i]):r+=e[i],r+=" ";return r},w=null,O=!0,S=function(t,e){Object(l.a)(!e||!0===t||!1===t,"Can't turn on custom loggers persistently."),!0===t?("undefined"!=typeof console&&("function"==typeof console.log?w=console.log.bind(console):"object"===v(console.log)&&(w=function(t){console.log(t)})),e&&_.b.set("logging_enabled",!0)):"function"==typeof t?w=t:(w=null,_.b.remove("logging_enabled"))},T=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];if(!0===O&&(O=!1,null===w&&!0===_.b.get("logging_enabled")&&S(!0)),w){var n=E.apply(null,t);w(n)}},N=function(t){return function(){for(var e=[],n=0;n<arguments.length;n++)e[n]=arguments[n];T.apply(void 0,[t].concat(e))}},I=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];if("undefined"!=typeof console){var n="FIREBASE INTERNAL ERROR: "+E.apply(void 0,t);void 0!==console.error?console.error(n):console.log(n)}},P=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var n=E.apply(void 0,t);throw Error("FIREBASE FATAL ERROR: "+n)},R=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];if("undefined"!=typeof console){var n="FIREBASE WARNING: "+E.apply(void 0,t);void 0!==console.warn?console.warn(n):console.log(n)}},D=function(){"undefined"!=typeof window&&window.location&&window.location.protocol&&-1!==window.location.protocol.indexOf("https:")&&R("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().")},j=function(t){return"number"==typeof t&&(t!=t||t==Number.POSITIVE_INFINITY||t==Number.NEGATIVE_INFINITY)},x=function(t){if(Object(y.b)()||"complete"===document.readyState)t();else{var e=!1,n=function n(){if(!document.body)return void setTimeout(n,Math.floor(10));e||(e=!0,t())};document.addEventListener?(document.addEventListener("DOMContentLoaded",n,!1),window.addEventListener("load",n,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",function(){"complete"===document.readyState&&n()}),window.attachEvent("onload",n))}},k="[MIN_NAME]",F="[MAX_NAME]",A=function(t,e){if(t===e)return 0;if(t===k||e===F)return-1;if(e===k||t===F)return 1;var n=Y(t),r=Y(e);return null!==n?null!==r?n-r==0?t.length-e.length:n-r:-1:null!==r?1:t<e?-1:1},L=function(t,e){return t===e?0:t<e?-1:1},M=function(t,e){if(e&&t in e)return e[t];throw Error("Missing required key ("+t+") in object: "+Object(f.b)(e))},W=function t(e){if("object"!==(void 0===e?"undefined":v(e))||null===e)return Object(f.b)(e);var n=[];for(var r in e)n.push(r);n.sort();for(var i="{",o=0;o<n.length;o++)0!==o&&(i+=","),i+=Object(f.b)(n[o]),i+=":",i+=t(e[n[o]]);return i+="}"},q=function(t,e){var n=t.length;if(n<=e)return[t];for(var r=[],i=0;i<n;i+=e)i+e>n?r.push(t.substring(i,n)):r.push(t.substring(i,i+e));return r},Q=function(t,e){if(Array.isArray(t))for(var n=0;n<t.length;++n)e(n,t[n]);else Object(p.f)(t,function(t,n){return e(n,t)})},U=function(t){Object(l.a)(!j(t),"Invalid JSON number");var e,n,r,i,o,s,a;for(0===t?(n=0,r=0,e=1/t==-1/0?1:0):(e=t<0,t=Math.abs(t),t>=Math.pow(2,-1022)?(i=Math.min(Math.floor(Math.log(t)/Math.LN2),1023),n=i+1023,r=Math.round(t*Math.pow(2,52-i)-Math.pow(2,52))):(n=0,r=Math.round(t/Math.pow(2,-1074)))),s=[],o=52;o;o-=1)s.push(r%2?1:0),r=Math.floor(r/2);for(o=11;o;o-=1)s.push(n%2?1:0),n=Math.floor(n/2);s.push(e?1:0),s.reverse(),a=s.join("");var u="";for(o=0;o<64;o+=8){var c=parseInt(a.substr(o,8),2).toString(16);1===c.length&&(c="0"+c),u+=c}return u.toLowerCase()},V=function(){return!("object"!==("undefined"==typeof window?"undefined":v(window))||!window.chrome||!window.chrome.extension||/^chrome/.test(window.location.href))},B=function(){return"object"===("undefined"==typeof Windows?"undefined":v(Windows))&&"object"===v(Windows.UI)},H=function(t,e){var n="Unknown Error";"too_big"===t?n="The data requested exceeds the maximum size that can be accessed with a single request.":"permission_denied"==t?n="Client doesn't have permission to access the desired data.":"unavailable"==t&&(n="The service is unavailable");var r=Error(t+" at "+e.path+": "+n);return r.code=t.toUpperCase(),r},K=RegExp("^-?\\d{1,10}$"),Y=function(t){if(K.test(t)){var e=+t;if(e>=-2147483648&&e<=2147483647)return e}return null},z=function(t){try{t()}catch(t){setTimeout(function(){var e=t.stack||"";throw R("Exception was thrown by user callback.",e),t},Math.floor(0))}},G=function(){return("object"===("undefined"==typeof window?"undefined":v(window))&&window.navigator&&window.navigator.userAgent||"").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i)>=0},X=function(t,e){var n=setTimeout(t,e);return"object"===(void 0===n?"undefined":v(n))&&n.unref&&n.unref(),n}},function(t,e,n){"use strict";n.d(e,"b",function(){return r}),n.d(e,"l",function(){return i}),n.d(e,"f",function(){return o}),n.d(e,"a",function(){return a}),n.d(e,"j",function(){return u}),n.d(e,"h",function(){return c}),n.d(e,"k",function(){return h}),n.d(e,"d",function(){return l}),n.d(e,"e",function(){return p}),n.d(e,"g",function(){return d}),n.d(e,"i",function(){return f}),n.d(e,"c",function(){return _});var r=("function"==typeof Symbol&&Symbol.iterator,function(t,e){return Object.prototype.hasOwnProperty.call(t,e)}),i=function(t,e){if(Object.prototype.hasOwnProperty.call(t,e))return t[e]},o=function(t,e){for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&e(n,t[n])},s=function(t,e){return o(e,function(e,n){t[e]=n}),t},a=function(t){return s({},t)},u=function(t){for(var e in t)return!1;return!0},c=function(t){var e=0;for(var n in t)e++;return e},h=function(t,e,n){var r={};for(var i in t)r[i]=e.call(n,t[i],i,t);return r},l=function(t,e,n){for(var r in t)if(e.call(n,t[r],r,t))return r},p=function(t,e,n){var r=l(t,e,n);return r&&t[r]},d=function(t){for(var e in t)return e},f=function(t){var e=[],n=0;for(var r in t)e[n++]=t[r];return e},_=function(t,e){for(var n in t)if(Object.prototype.hasOwnProperty.call(t,n)&&!e(n,t[n]))return!1;return!0}},function(t,e,n){"use strict";n.d(e,"a",function(){return r}),n.d(e,"b",function(){return i});var r=function(t){return JSON.parse(t)},i=function(t){return JSON.stringify(t)}},,,function(t,e,n){"use strict";n.d(e,"a",function(){return s}),n.d(e,"c",function(){return a}),n.d(e,"b",function(){return u});var r=n(7),i="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},o=function(){return"undefined"!=typeof navigator&&"string"==typeof navigator.userAgent?navigator.userAgent:""},s=function(){return"undefined"!=typeof window&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(o())},a=function(){return"object"===("undefined"==typeof navigator?"undefined":i(navigator))&&"ReactNative"===navigator.product},u=function(){return!0===r.a.NODE_CLIENT||!0===r.a.NODE_ADMIN}},function(t,e,n){"use strict";n.d(e,"a",function(){return r});var r={NODE_CLIENT:!1,NODE_ADMIN:!1,SDK_VERSION:"4.2.0"}},function(t,e,n){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=n(3),i=function(){function t(t){this.Q=t,this.U="firebase:"}return t.prototype.set=function(t,e){null==e?this.Q.removeItem(this.V(t)):this.Q.setItem(this.V(t),Object(r.b)(e))},t.prototype.get=function(t){var e=this.Q.getItem(this.V(t));return null==e?null:Object(r.a)(e)},t.prototype.remove=function(t){this.Q.removeItem(this.V(t))},t.prototype.V=function(t){return this.U+t},t.prototype.toString=function(){return""+this.Q},t}(),o=n(2),s=function(){function t(){this.H={},this.isInMemoryStorage=!0}return t.prototype.set=function(t,e){null==e?delete this.H[t]:this.H[t]=e},t.prototype.get=function(t){return Object(o.b)(this.H,t)?this.H[t]:null},t.prototype.remove=function(t){delete this.H[t]},t}();n.d(e,"a",function(){return u}),n.d(e,"b",function(){return c});var a=function(t){try{if("undefined"!=typeof window&&void 0!==window[t]){var e=window[t];return e.setItem("firebase:sentinel","cache"),e.removeItem("firebase:sentinel"),new i(e)}}catch(t){}return new s},u=a("localStorage"),c=a("sessionStorage")},function(t,e,n){"use strict";n.d(e,"e",function(){return r}),n.d(e,"h",function(){return i}),n.d(e,"g",function(){return o}),n.d(e,"f",function(){return s}),n.d(e,"b",function(){return a}),n.d(e,"a",function(){return u}),n.d(e,"c",function(){return c}),n.d(e,"i",function(){return h}),n.d(e,"d",function(){return l});var r="5",i="v",o="s",s="r",a="f",u="firebaseio.com",c="ls",h="websocket",l="long_polling"},,function(t,e,n){"use strict";n.d(e,"b",function(){return i}),n.d(e,"a",function(){return o});var r=n(0),i=function(t){for(var e=[],n=0,i=0;i<t.length;i++){var o=t.charCodeAt(i);if(o>=55296&&o<=56319){var s=o-55296;i++,Object(r.a)(i<t.length,"Surrogate pair missing trail surrogate."),o=65536+(s<<10)+(t.charCodeAt(i)-56320)}o<128?e[n++]=o:o<2048?(e[n++]=o>>6|192,e[n++]=63&o|128):o<65536?(e[n++]=o>>12|224,e[n++]=o>>6&63|128,e[n++]=63&o|128):(e[n++]=o>>18|240,e[n++]=o>>12&63|128,e[n++]=o>>6&63|128,e[n++]=63&o|128)}return e},o=function(t){for(var e=0,n=0;n<t.length;n++){var r=t.charCodeAt(n);r<128?e++:r<2048?e+=2:r>=55296&&r<=56319?(e+=4,n++):e+=3}return e}},function(t,e,n){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r=n(17),i=n(2),o=function(){function t(){this.K={}}return t.prototype.incrementCounter=function(t,e){void 0===e&&(e=1),Object(i.b)(this.K,t)||(this.K[t]=0),this.K[t]+=e},t.prototype.get=function(){return Object(r.a)(this.K)},t}();n.d(e,"a",function(){return s});var s=function(){function t(){}return t.getCollection=function(t){var e=""+t;return this.Y[e]||(this.Y[e]=new o),this.Y[e]},t.getOrCreateReporter=function(t,e){var n=""+t;return this.G[n]||(this.G[n]=e()),this.G[n]},t.Y={},t.G={},t}()},,,,,,function(t,e,n){"use strict";(function(t){n.d(e,"a",function(){return d});var r=n(5),i=n(0),o=n(1),s=n(12),a=n(9),u=n(7),c=n(8),h=n(3),l=n(6),p=null;"undefined"!=typeof MozWebSocket?p=MozWebSocket:"undefined"!=typeof WebSocket&&(p=WebSocket);var d=function(){function e(t,n,r,i){this.connId=t,this.keepaliveTimer=null,this.frames=null,this.totalFrames=0,this.bytesSent=0,this.bytesReceived=0,this.X=Object(o.t)(this.connId),this.$=s.a.getCollection(n),this.connURL=e.J(n,r,i)}return e.J=function(t,e,n){var r={};return r[a.h]=a.e,!Object(l.b)()&&"undefined"!=typeof location&&location.href&&-1!==location.href.indexOf(a.a)&&(r[a.f]=a.b),e&&(r[a.g]=e),n&&(r[a.c]=n),t.connectionURL(a.i,r)},e.prototype.open=function(e,n){var i=this;this.onDisconnect=n,this.onMessage=e,this.X("Websocket connecting to "+this.connURL),this.Z=!1,c.a.set("previous_websocket_failure",!0);try{if(Object(l.b)()){var o=u.a.NODE_ADMIN?"AdminNode":"Node",s={headers:{"User-Agent":"Firebase/"+a.e+"/"+r.default.SDK_VERSION+"/"+t.platform+"/"+o}},h=t.env,d=0==this.connURL.indexOf("wss://")?h.HTTPS_PROXY||h.https_proxy:h.HTTP_PROXY||h.http_proxy;d&&(s.proxy={origin:d}),this.mySock=new p(this.connURL,[],s)}else this.mySock=new p(this.connURL)}catch(t){this.X("Error instantiating WebSocket.");var f=t.message||t.data;return f&&this.X(f),void this.tt()}this.mySock.onopen=function(){i.X("Websocket connected."),i.Z=!0},this.mySock.onclose=function(){i.X("Websocket connection was disconnected."),i.mySock=null,i.tt()},this.mySock.onmessage=function(t){i.handleIncomingFrame(t)},this.mySock.onerror=function(t){i.X("WebSocket error.  Closing connection.");var e=t.message||t.data;e&&i.X(e),i.tt()}},e.prototype.start=function(){},e.forceDisallow=function(){e.et=!0},e.isAvailable=function(){var t=!1;if("undefined"!=typeof navigator&&navigator.userAgent){var n=/Android ([0-9]{0,}\.[0-9]{0,})/,r=navigator.userAgent.match(n);r&&r.length>1&&parseFloat(r[1])<4.4&&(t=!0)}return!t&&null!==p&&!e.et},e.previouslyFailed=function(){return c.a.isInMemoryStorage||!0===c.a.get("previous_websocket_failure")},e.prototype.markConnectionHealthy=function(){c.a.remove("previous_websocket_failure")},e.prototype.nt=function(t){if(this.frames.push(t),this.frames.length==this.totalFrames){var e=this.frames.join("");this.frames=null;var n=Object(h.a)(e);this.onMessage(n)}},e.prototype.rt=function(t){this.totalFrames=t,this.frames=[]},e.prototype.it=function(t){if(Object(i.a)(null===this.frames,"We already have a frame buffer"),t.length<=6){var e=+t;if(!isNaN(e))return this.rt(e),null}return this.rt(1),t},e.prototype.handleIncomingFrame=function(t){if(null!==this.mySock){var e=t.data;if(this.bytesReceived+=e.length,this.$.incrementCounter("bytes_received",e.length),this.resetKeepAlive(),null!==this.frames)this.nt(e);else{var n=this.it(e);null!==n&&this.nt(n)}}},e.prototype.send=function(t){this.resetKeepAlive();var e=Object(h.b)(t);this.bytesSent+=e.length,this.$.incrementCounter("bytes_sent",e.length);var n=Object(o.z)(e,16384);n.length>1&&this.ot(n.length+"");for(var r=0;r<n.length;r++)this.ot(n[r])},e.prototype.st=function(){this.ut=!0,this.keepaliveTimer&&(clearInterval(this.keepaliveTimer),this.keepaliveTimer=null),this.mySock&&(this.mySock.close(),this.mySock=null)},e.prototype.tt=function(){this.ut||(this.X("WebSocket is closing itself"),this.st(),this.onDisconnect&&(this.onDisconnect(this.Z),this.onDisconnect=null))},e.prototype.close=function(){this.ut||(this.X("WebSocket is being closed"),this.st())},e.prototype.resetKeepAlive=function(){var t=this;clearInterval(this.keepaliveTimer),this.keepaliveTimer=setInterval(function(){t.mySock&&t.ot("0"),t.resetKeepAlive()},Math.floor(45e3))},e.prototype.ot=function(t){try{this.mySock.send(t)}catch(t){this.X("Exception thrown from WebSocket.send():",t.message||t.data,"Closing connection."),setTimeout(this.tt.bind(this),0)}},e.responsesRequiredToBeHealthy=2,e.healthyTimeout=3e4,e}()}).call(e,n(16))},,,,,,,function(t,e,n){"use strict";function r(t){for(var e="",n=t.split("/"),r=0;r<n.length;r++)if(n[r].length>0){var i=n[r];try{i=decodeURIComponent(i.replace(/\+/g," "))}catch(t){}e+="/"+i}return e}function i(t,e,n){var r="";switch(e){case 1:r=n?"first":"First";break;case 2:r=n?"second":"Second";break;case 3:r=n?"third":"Third";break;case 4:r=n?"fourth":"Fourth";break;default:throw Error("errorPrefix called with argumentNumber > 4.  Need to update it?")}var i=t+" failed: ";return i+=r+" argument "}function o(t,e){return Object(Wt.v)(t.name,e.name)}function s(t,e){return Object(Wt.v)(t,e)}function a(t,e){if(void 0===e&&(e=null),null===t)return Vt.EMPTY_NODE;if("object"===(void 0===t?"undefined":zt(t))&&".priority"in t&&(e=t[".priority"]),Object(Yt.a)(null===e||"string"==typeof e||"number"==typeof e||"object"===(void 0===e?"undefined":zt(e))&&".sv"in e,"Invalid priority type found: "+(void 0===e?"undefined":zt(e))),"object"===(void 0===t?"undefined":zt(t))&&".value"in t&&null!==t[".value"]&&(t=t[".value"]),"object"!==(void 0===t?"undefined":zt(t))||".sv"in t)return new wt(t,a(e));if(t instanceof Array||!Gt){var n=Vt.EMPTY_NODE,r=t;return Object(Kt.f)(r,function(t,e){if(Object(Kt.b)(r,t)&&"."!==t.substring(0,1)){var i=a(e);!i.isLeafNode()&&i.isEmpty()||(n=n.updateImmediateChild(t,i))}}),n.updatePriority(a(e))}var i=[],u=!1,c=t;if(Object(Kt.f)(c,function(t,e){if("string"!=typeof t||"."!==t.substring(0,1)){var n=a(c[t]);n.isEmpty()||(u=u||!n.getPriority().isEmpty(),i.push(new st(t,n)))}}),0==i.length)return Vt.EMPTY_NODE;var h=kt(i,o,function(t){return t.name},s);if(u){var l=kt(i,Nt.getCompare());return new Vt(h,a(e),new Mt({".priority":l},{".priority":Nt}))}return new Vt(h,a(e),Mt.Default)}Object.defineProperty(e,"__esModule",{value:!0});var u,c,h,l,p,d,f,_=n(1),y=n(11),v=function(){function t(t,e){if(void 0===e){this.ct=t.split("/");for(var n=0,r=0;r<this.ct.length;r++)this.ct[r].length>0&&(this.ct[n]=this.ct[r],n++);this.ct.length=n,this.ht=0}else this.ct=t,this.ht=e}return Object.defineProperty(t,"Empty",{get:function(){return new t("")},enumerable:!0,configurable:!0}),t.prototype.getFront=function(){return this.ht>=this.ct.length?null:this.ct[this.ht]},t.prototype.getLength=function(){return this.ct.length-this.ht},t.prototype.popFront=function(){var e=this.ht;return e<this.ct.length&&e++,new t(this.ct,e)},t.prototype.getBack=function(){return this.ht<this.ct.length?this.ct[this.ct.length-1]:null},t.prototype.toString=function(){for(var t="",e=this.ht;e<this.ct.length;e++)""!==this.ct[e]&&(t+="/"+this.ct[e]);return t||"/"},t.prototype.toUrlEncodedString=function(){for(var t="",e=this.ht;e<this.ct.length;e++)""!==this.ct[e]&&(t+="/"+encodeURIComponent(this.ct[e]+""));return t||"/"},t.prototype.slice=function(t){return void 0===t&&(t=0),this.ct.slice(this.ht+t)},t.prototype.parent=function(){if(this.ht>=this.ct.length)return null;for(var e=[],n=this.ht;n<this.ct.length-1;n++)e.push(this.ct[n]);return new t(e,0)},t.prototype.child=function(e){for(var n=[],r=this.ht;r<this.ct.length;r++)n.push(this.ct[r]);if(e instanceof t)for(var r=e.ht;r<e.ct.length;r++)n.push(e.ct[r]);else for(var i=e.split("/"),r=0;r<i.length;r++)i[r].length>0&&n.push(i[r]);return new t(n,0)},t.prototype.isEmpty=function(){return this.ht>=this.ct.length},t.relativePath=function(e,n){var r=e.getFront(),i=n.getFront();if(null===r)return n;if(r===i)return t.relativePath(e.popFront(),n.popFront());throw Error("INTERNAL ERROR: innerPath ("+n+") is not within outerPath ("+e+")")},t.comparePaths=function(t,e){for(var n=t.slice(),r=e.slice(),i=0;i<n.length&&i<r.length;i++){var o=Object(_.v)(n[i],r[i]);if(0!==o)return o}return n.length===r.length?0:n.length<r.length?-1:1},t.prototype.equals=function(t){if(this.getLength()!==t.getLength())return!1;for(var e=this.ht,n=t.ht;e<=this.ct.length;e++,n++)if(this.ct[e]!==t.ct[n])return!1;return!0},t.prototype.contains=function(t){var e=this.ht,n=t.ht;if(this.getLength()>t.getLength())return!1;for(;e<this.ct.length;){if(this.ct[e]!==t.ct[n])return!1;++e,++n}return!0},t}(),g=function(){function t(t,e){this.lt=e,this.pt=t.slice(),this.dt=Math.max(1,this.pt.length);for(var n=0;n<this.pt.length;n++)this.dt+=Object(y.a)(this.pt[n]);this.ft()}return Object.defineProperty(t,"MAX_PATH_DEPTH",{get:function(){return 32},enumerable:!0,configurable:!0}),Object.defineProperty(t,"MAX_PATH_LENGTH_BYTES",{get:function(){return 768},enumerable:!0,configurable:!0}),t.prototype.push=function(t){this.pt.length>0&&(this.dt+=1),this.pt.push(t),this.dt+=Object(y.a)(t),this.ft()},t.prototype.pop=function(){var t=this.pt.pop();this.dt-=Object(y.a)(t),this.pt.length>0&&(this.dt-=1)},t.prototype.ft=function(){if(this.dt>t.MAX_PATH_LENGTH_BYTES)throw Error(this.lt+"has a key path longer than "+t.MAX_PATH_LENGTH_BYTES+" bytes ("+this.dt+").");if(this.pt.length>t.MAX_PATH_DEPTH)throw Error(this.lt+"path specified exceeds the maximum depth that can be written ("+t.MAX_PATH_DEPTH+") or object contains a cycle "+this.toErrorString())},t.prototype.toErrorString=function(){return 0==this.pt.length?"":"in property '"+this.pt.join(".")+"'"},t}(),m=n(0),b=n(2),C=n(8),E=n(9),w="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},O=function(){function t(t,e,n,r,i){void 0===i&&(i=""),this.secure=e,this.namespace=n,this.webSocketOnly=r,this.persistenceKey=i,this.host=t.toLowerCase(),this.domain=this.host.substr(this.host.indexOf(".")+1),this.internalHost=C.a.get("host:"+t)||this.host}return t.prototype.needsQueryParam=function(){return this.host!==this.internalHost},t.prototype.isCacheableHost=function(){return"s-"===this.internalHost.substr(0,2)},t.prototype.isDemoHost=function(){return"firebaseio-demo.com"===this.domain},t.prototype.isCustomHost=function(){return"firebaseio.com"!==this.domain&&"firebaseio-demo.com"!==this.domain},t.prototype.updateHost=function(t){t!==this.internalHost&&(this.internalHost=t,this.isCacheableHost()&&C.a.set("host:"+this.host,this.internalHost))},t.prototype.connectionURL=function(t,e){Object(m.a)("string"==typeof t,"typeof type must == string"),Object(m.a)("object"===(void 0===e?"undefined":w(e)),"typeof params must == object");var n;if(t===E.i)n=(this.secure?"wss://":"ws://")+this.internalHost+"/.ws?";else{if(t!==E.d)throw Error("Unknown connection type: "+t);n=(this.secure?"https://":"http://")+this.internalHost+"/.lp?"}this.needsQueryParam()&&(e.ns=this.namespace);var r=[];return Object(b.f)(e,function(t,e){r.push(t+"="+e)}),n+r.join("&")},t.prototype.toString=function(){var t=this.toURLString();return this.persistenceKey&&(t+="<"+this.persistenceKey+">"),t},t.prototype.toURLString=function(){return(this.secure?"https://":"http://")+this.host},t}(),S=n(1),T=function(t){var e=N(t),n=e.subdomain;"firebase"===e.domain&&Object(S.o)(e.host+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead"),n&&"undefined"!=n||Object(S.o)("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com"),e.secure||Object(S.C)();var r="ws"===e.scheme||"wss"===e.scheme;return{repoInfo:new O(e.host,e.secure,n,r),path:new v(e.pathString)}},N=function(t){var e="",n="",i="",o="",s=!0,a="https",u=443;if("string"==typeof t){var c=t.indexOf("//");c>=0&&(a=t.substring(0,c-1),t=t.substring(c+2));var h=t.indexOf("/");-1===h&&(h=t.length),e=t.substring(0,h),o=r(t.substring(h));var l=e.split(".");3===l.length?(n=l[1],i=l[0].toLowerCase()):2===l.length&&(n=l[0]),(c=e.indexOf(":"))>=0&&(s="https"===a||"wss"===a,u=parseInt(e.substring(c+1),10))}return{host:e,port:u,domain:n,subdomain:i,secure:s,scheme:a,pathString:o}},I="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},P=function(t,e,n,r){var i;if(r<e?i="at least "+e:r>n&&(i=0===n?"none":"no more than "+n),i){var o=t+" failed: Was called with "+r+(1===r?" argument.":" arguments.")+" Expects "+i+".";throw Error(o)}},R=function(t,e,n,r){if((!r||n)&&"function"!=typeof n)throw Error(i(t,e,r)+"must be a valid function.")},D=function(t,e,n,r){if((!r||n)&&("object"!==(void 0===n?"undefined":I(n))||null===n))throw Error(i(t,e,r)+"must be a valid context object.")},j=n(2),x=n(1),k=n(11),F="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},A=/[\[\].#$\/\u0000-\u001F\u007F]/,L=/[\[\].#$\u0000-\u001F\u007F]/,M=function(t){return"string"==typeof t&&0!==t.length&&!A.test(t)},W=function(t){return"string"==typeof t&&0!==t.length&&!L.test(t)},q=function(t){return t&&(t=t.replace(/^\/*\.info(\/|$)/,"/")),W(t)},Q=function(t){return null===t||"string"==typeof t||"number"==typeof t&&!Object(x.q)(t)||t&&"object"===(void 0===t?"undefined":F(t))&&Object(j.b)(t,".sv")},U=function(t,e,n,r,o){o&&void 0===n||V(i(t,e,o),n,r)},V=function t(e,n,r){var i=r instanceof v?new g(r,e):r;if(void 0===n)throw Error(e+"contains undefined "+i.toErrorString());if("function"==typeof n)throw Error(e+"contains a function "+i.toErrorString()+" with contents = "+n);if(Object(x.q)(n))throw Error(e+"contains "+n+" "+i.toErrorString());if("string"==typeof n&&n.length>10485760/3&&Object(k.a)(n)>10485760)throw Error(e+"contains a string greater than 10485760 utf8 bytes "+i.toErrorString()+" ('"+n.substring(0,50)+"...')");if(n&&"object"===(void 0===n?"undefined":F(n))){var o=!1,s=!1;if(Object(j.f)(n,function(n,r){if(".value"===n)o=!0;else if(".priority"!==n&&".sv"!==n&&(s=!0,!M(n)))throw Error(e+" contains an invalid key ("+n+") "+i.toErrorString()+'.  Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');i.push(n),t(e,r,i),i.pop()}),o&&s)throw Error(e+' contains ".value" child '+i.toErrorString()+" in addition to actual children.")}},B=function(t,e){var n,r;for(n=0;n<e.length;n++){r=e[n];for(var i=r.slice(),o=0;o<i.length;o++)if(".priority"===i[o]&&o===i.length-1);else if(!M(i[o]))throw Error(t+"contains an invalid key ("+i[o]+") in path "+r+'. Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"')}e.sort(v.comparePaths);var s=null;for(n=0;n<e.length;n++){if(r=e[n],null!==s&&s.contains(r))throw Error(t+"contains a path "+s+" that is ancestor of another path "+r);s=r}},H=function(t,e,n,r,o){if(!o||void 0!==n){var s=i(t,e,o);if(!n||"object"!==(void 0===n?"undefined":F(n))||Array.isArray(n))throw Error(s+" must be an object containing the children to replace.");var a=[];Object(j.f)(n,function(t,e){var n=new v(t);if(V(s,e,r.child(n)),".priority"===n.getBack()&&!Q(e))throw Error(s+"contains an invalid value for '"+n+"', which must be a valid Firebase priority (a string, finite number, server value, or null).");a.push(n)}),B(s,a)}},K=function(t,e,n,r){if(!r||void 0!==n){if(Object(x.q)(n))throw Error(i(t,e,r)+"is "+n+", but must be a valid Firebase priority (a string, finite number, server value, or null).");if(!Q(n))throw Error(i(t,e,r)+"must be a valid Firebase priority (a string, finite number, server value, or null).")}},Y=function(t,e,n,r){if(!r||void 0!==n)switch(n){case"value":case"child_added":case"child_removed":case"child_changed":case"child_moved":break;default:throw Error(i(t,e,r)+'must be a valid event type = "value", "child_added", "child_removed", "child_changed", or "child_moved".')}},z=function(t,e,n,r){if(!(r&&void 0===n||M(n)))throw Error(i(t,e,r)+'was an invalid key = "'+n+'".  Firebase keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]").')},G=function(t,e,n,r){if(!(r&&void 0===n||W(n)))throw Error(i(t,e,r)+'was an invalid path = "'+n+'". Paths must be non-empty strings and can\'t contain ".", "#", "$", "[", or "]"')},X=function(t,e,n,r){n&&(n=n.replace(/^\/*\.info(\/|$)/,"/")),G(t,e,n,r)},$=function(t,e){if(".info"===e.getFront())throw Error(t+" failed = Can't modify data under /.info/")},J=function(t,e,n){var r=""+n.path;if("string"!=typeof n.repoInfo.host||0===n.repoInfo.host.length||!M(n.repoInfo.namespace)||0!==r.length&&!q(r))throw Error(i(t,e,!1)+'must be a valid firebase URL and the path can\'t contain ".", "#", "$", "[", or "]".')},Z=function(t,e,n,r){if((!r||void 0!==n)&&"boolean"!=typeof n)throw Error(i(t,e,r)+"must be a boolean.")},tt=n(1),et=n(4),nt=function(){function t(t,e){this._t=t,this.yt=e}return t.prototype.cancel=function(t){P("OnDisconnect.cancel",0,1,arguments.length),R("OnDisconnect.cancel",1,t,!0);var e=new et.a;return this._t.onDisconnectCancel(this.yt,e.wrapCallback(t)),e.promise},t.prototype.remove=function(t){P("OnDisconnect.remove",0,1,arguments.length),$("OnDisconnect.remove",this.yt),R("OnDisconnect.remove",1,t,!0);var e=new et.a;return this._t.onDisconnectSet(this.yt,null,e.wrapCallback(t)),e.promise},t.prototype.set=function(t,e){P("OnDisconnect.set",1,2,arguments.length),$("OnDisconnect.set",this.yt),U("OnDisconnect.set",1,t,this.yt,!1),R("OnDisconnect.set",2,e,!0);var n=new et.a;return this._t.onDisconnectSet(this.yt,t,n.wrapCallback(e)),n.promise},t.prototype.setWithPriority=function(t,e,n){P("OnDisconnect.setWithPriority",2,3,arguments.length),$("OnDisconnect.setWithPriority",this.yt),U("OnDisconnect.setWithPriority",1,t,this.yt,!1),K("OnDisconnect.setWithPriority",2,e,!1),R("OnDisconnect.setWithPriority",3,n,!0);var r=new et.a;return this._t.onDisconnectSetWithPriority(this.yt,t,e,r.wrapCallback(n)),r.promise},t.prototype.update=function(t,e){if(P("OnDisconnect.update",1,2,arguments.length),$("OnDisconnect.update",this.yt),Array.isArray(t)){for(var n={},r=0;r<t.length;++r)n[""+r]=t[r];t=n,Object(tt.B)("Passing an Array to firebase.database.onDisconnect().update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}H("OnDisconnect.update",1,t,this.yt,!1),R("OnDisconnect.update",2,e,!0);var i=new et.a;return this._t.onDisconnectUpdate(this.yt,t,i.wrapCallback(e)),i.promise},t}(),rt=function(){function t(t,e){this.committed=t,this.snapshot=e}return t.prototype.toJSON=function(){return P("TransactionResult.toJSON",0,1,arguments.length),{committed:this.committed,snapshot:this.snapshot.toJSON()}},t}(),it=n(0),ot=function(){var t="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",e=0,n=[];return function(r){var i=r===e;e=r;var o,s=Array(8);for(o=7;o>=0;o--)s[o]=t.charAt(r%64),r=Math.floor(r/64);Object(it.a)(0===r,"Cannot push at time == 0");var a=s.join("");if(i){for(o=11;o>=0&&63===n[o];o--)n[o]=0;n[o]++}else for(o=0;o<12;o++)n[o]=Math.floor(64*Math.random());for(o=0;o<12;o++)a+=t.charAt(n[o]);return Object(it.a)(20===a.length,"nextPushId: Length should be 20."),a}}(),st=function(){function t(t,e){this.name=t,this.node=e}return t.Wrap=function(e,n){return new t(e,n)},t}(),at=n(1),ut=function(){function t(){}return t.prototype.getCompare=function(){return this.compare.bind(this)},t.prototype.indexedValueChanged=function(t,e){var n=new st(at.c,t),r=new st(at.c,e);return 0!==this.compare(n,r)},t.prototype.minPost=function(){return st.MIN},t}(),ct=n(1),ht=n(0),lt=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),pt=function(t){function e(){return null!==t&&t.apply(this,arguments)||this}return lt(e,t),Object.defineProperty(e,"__EMPTY_NODE",{get:function(){return u},set:function(t){u=t},enumerable:!0,configurable:!0}),e.prototype.compare=function(t,e){return Object(ct.v)(t.name,e.name)},e.prototype.isDefinedOn=function(t){throw Object(ht.b)("KeyIndex.isDefinedOn not expected to be called.")},e.prototype.indexedValueChanged=function(t,e){return!1},e.prototype.minPost=function(){return st.MIN},e.prototype.maxPost=function(){return new st(ct.b,u)},e.prototype.makePost=function(t,e){return Object(ht.a)("string"==typeof t,"KeyIndex indexValue must always be a string."),new st(t,u)},e.prototype.toString=function(){return".key"},e}(ut),dt=new pt,ft=n(0),_t=n(1),yt=n(2),vt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},gt=function(t){return"number"==typeof t?"number:"+Object(_t.h)(t):"string:"+t},mt=function(t){if(t.isLeafNode()){var e=t.val();Object(ft.a)("string"==typeof e||"number"==typeof e||"object"===(void 0===e?"undefined":vt(e))&&Object(yt.b)(e,".sv"),"Priority must be a string or number.")}else Object(ft.a)(t===c||t.isEmpty(),"priority of unexpected type.");Object(ft.a)(t===c||t.getPriority().isEmpty(),"Priority nodes can't have a priority of their own.")},bt=n(0),Ct=n(1),Et="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},wt=function(){function t(e,n){void 0===n&&(n=t.vt.EMPTY_NODE),this.gt=e,this.mt=n,this.bt=null,Object(bt.a)(void 0!==this.gt&&null!==this.gt,"LeafNode shouldn't be created with null/undefined value."),mt(this.mt)}return Object.defineProperty(t,"__childrenNodeConstructor",{get:function(){return h},set:function(t){h=t},enumerable:!0,configurable:!0}),t.prototype.isLeafNode=function(){return!0},t.prototype.getPriority=function(){return this.mt},t.prototype.updatePriority=function(e){return new t(this.gt,e)},t.prototype.getImmediateChild=function(e){return".priority"===e?this.mt:t.vt.EMPTY_NODE},t.prototype.getChild=function(e){return e.isEmpty()?this:".priority"===e.getFront()?this.mt:t.vt.EMPTY_NODE},t.prototype.hasChild=function(){return!1},t.prototype.getPredecessorChildName=function(t,e){return null},t.prototype.updateImmediateChild=function(e,n){return".priority"===e?this.updatePriority(n):n.isEmpty()&&".priority"!==e?this:t.vt.EMPTY_NODE.updateImmediateChild(e,n).updatePriority(this.mt)},t.prototype.updateChild=function(e,n){var r=e.getFront();return null===r?n:n.isEmpty()&&".priority"!==r?this:(Object(bt.a)(".priority"!==r||1===e.getLength(),".priority must be the last token in a path"),this.updateImmediateChild(r,t.vt.EMPTY_NODE.updateChild(e.popFront(),n)))},t.prototype.isEmpty=function(){return!1},t.prototype.numChildren=function(){return 0},t.prototype.forEachChild=function(t,e){return!1},t.prototype.val=function(t){return t&&!this.getPriority().isEmpty()?{".value":this.getValue(),".priority":this.getPriority().val()}:this.getValue()},t.prototype.hash=function(){if(null===this.bt){var t="";this.mt.isEmpty()||(t+="priority:"+gt(this.mt.val())+":");var e=Et(this.gt);t+=e+":",t+="number"===e?Object(Ct.h)(this.gt):this.gt,this.bt=Object(Ct.y)(t)}return this.bt},t.prototype.getValue=function(){return this.gt},t.prototype.compareTo=function(e){return e===t.vt.EMPTY_NODE?1:e instanceof t.vt?-1:(Object(bt.a)(e.isLeafNode(),"Unknown node type"),this.Ct(e))},t.prototype.Ct=function(e){var n=Et(e.gt),r=Et(this.gt),i=t.VALUE_TYPE_ORDER.indexOf(n),o=t.VALUE_TYPE_ORDER.indexOf(r);return Object(bt.a)(i>=0,"Unknown leaf type: "+n),Object(bt.a)(o>=0,"Unknown leaf type: "+r),i===o?"object"===r?0:this.gt<e.gt?-1:this.gt===e.gt?0:1:o-i},t.prototype.withIndex=function(){return this},t.prototype.isIndexed=function(){return!0},t.prototype.equals=function(t){if(t===this)return!0;if(t.isLeafNode()){var e=t;return this.gt===e.gt&&this.mt.equals(e.mt)}return!1},t.VALUE_TYPE_ORDER=["object","boolean","number","string"],t}(),Ot=n(1),St=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),Tt=function(t){function e(){return null!==t&&t.apply(this,arguments)||this}return St(e,t),e.prototype.compare=function(t,e){var n=t.node.getPriority(),r=e.node.getPriority(),i=n.compareTo(r);return 0===i?Object(Ot.v)(t.name,e.name):i},e.prototype.isDefinedOn=function(t){return!t.getPriority().isEmpty()},e.prototype.indexedValueChanged=function(t,e){return!t.getPriority().equals(e.getPriority())},e.prototype.minPost=function(){return st.MIN},e.prototype.maxPost=function(){return new st(Ot.b,new wt("[PRIORITY-POST]",p))},e.prototype.makePost=function(t,e){var n=l(t);return new st(e,new wt("[PRIORITY-POST]",n))},e.prototype.toString=function(){return".priority"},e}(ut),Nt=new Tt,It=function(){function t(t,e,n,r,i){void 0===i&&(i=null),this.Et=r,this.wt=i,this.Ot=[];for(var o=1;!t.isEmpty();)if(t=t,o=e?n(t.key,e):1,r&&(o*=-1),o<0)t=this.Et?t.left:t.right;else{if(0===o){this.Ot.push(t);break}this.Ot.push(t),t=this.Et?t.right:t.left}}return t.prototype.getNext=function(){if(0===this.Ot.length)return null;var t,e=this.Ot.pop();if(t=this.wt?this.wt(e.key,e.value):{key:e.key,value:e.value},this.Et)for(e=e.left;!e.isEmpty();)this.Ot.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.Ot.push(e),e=e.left;return t},t.prototype.hasNext=function(){return this.Ot.length>0},t.prototype.peek=function(){if(0===this.Ot.length)return null;var t=this.Ot[this.Ot.length-1];return this.wt?this.wt(t.key,t.value):{key:t.key,value:t.value}},t}(),Pt=function(){function t(e,n,r,i,o){this.key=e,this.value=n,this.color=null!=r?r:t.RED,this.left=null!=i?i:Dt.EMPTY_NODE,this.right=null!=o?o:Dt.EMPTY_NODE}return t.prototype.copy=function(e,n,r,i,o){return new t(null!=e?e:this.key,null!=n?n:this.value,null!=r?r:this.color,null!=i?i:this.left,null!=o?o:this.right)},t.prototype.count=function(){return this.left.count()+1+this.right.count()},t.prototype.isEmpty=function(){return!1},t.prototype.inorderTraversal=function(t){return this.left.inorderTraversal(t)||t(this.key,this.value)||this.right.inorderTraversal(t)},t.prototype.reverseTraversal=function(t){return this.right.reverseTraversal(t)||t(this.key,this.value)||this.left.reverseTraversal(t)},t.prototype.St=function(){return this.left.isEmpty()?this:this.left.St()},t.prototype.minKey=function(){return this.St().key},t.prototype.maxKey=function(){return this.right.isEmpty()?this.key:this.right.maxKey()},t.prototype.insert=function(t,e,n){var r,i;return i=this,r=n(t,i.key),i=r<0?i.copy(null,null,null,i.left.insert(t,e,n),null):0===r?i.copy(null,e,null,null,null):i.copy(null,null,null,null,i.right.insert(t,e,n)),i.Tt()},t.prototype.Nt=function(){if(this.left.isEmpty())return Dt.EMPTY_NODE;var t=this;return t.left.It()||t.left.left.It()||(t=t.Pt()),t=t.copy(null,null,null,t.left.Nt(),null),t.Tt()},t.prototype.remove=function(t,e){var n,r;if(n=this,e(t,n.key)<0)n.left.isEmpty()||n.left.It()||n.left.left.It()||(n=n.Pt()),n=n.copy(null,null,null,n.left.remove(t,e),null);else{if(n.left.It()&&(n=n.Rt()),n.right.isEmpty()||n.right.It()||n.right.left.It()||(n=n.Dt()),0===e(t,n.key)){if(n.right.isEmpty())return Dt.EMPTY_NODE;r=n.right.St(),n=n.copy(r.key,r.value,null,null,n.right.Nt())}n=n.copy(null,null,null,null,n.right.remove(t,e))}return n.Tt()},t.prototype.It=function(){return this.color},t.prototype.Tt=function(){var t=this;return t.right.It()&&!t.left.It()&&(t=t.jt()),t.left.It()&&t.left.left.It()&&(t=t.Rt()),t.left.It()&&t.right.It()&&(t=t.xt()),t},t.prototype.Pt=function(){var t=this.xt();return t.right.left.It()&&(t=t.copy(null,null,null,null,t.right.Rt()),t=t.jt(),t=t.xt()),t},t.prototype.Dt=function(){var t=this.xt();return t.left.left.It()&&(t=t.Rt(),t=t.xt()),t},t.prototype.jt=function(){var e=this.copy(null,null,t.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)},t.prototype.Rt=function(){var e=this.copy(null,null,t.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)},t.prototype.xt=function(){var t=this.left.copy(null,null,!this.left.color,null,null),e=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,t,e)},t.prototype.kt=function(){var t=this.Ft();return Math.pow(2,t)<=this.count()+1},t.prototype.Ft=function(){var t;if(this.It()&&this.left.It())throw Error("Red node has red child("+this.key+","+this.value+")");if(this.right.It())throw Error("Right child of ("+this.key+","+this.value+") is red");if((t=this.left.Ft())!==this.right.Ft())throw Error("Black depths differ");return t+(this.It()?0:1)},t.RED=!0,t.BLACK=!1,t}(),Rt=function(){function t(){}return t.prototype.copy=function(t,e,n,r,i){return this},t.prototype.insert=function(t,e,n){return new Pt(t,e,null)},t.prototype.remove=function(t,e){return this},t.prototype.count=function(){return 0},t.prototype.isEmpty=function(){return!0},t.prototype.inorderTraversal=function(t){return!1},t.prototype.reverseTraversal=function(t){return!1},t.prototype.minKey=function(){return null},t.prototype.maxKey=function(){return null},t.prototype.Ft=function(){return 0},t.prototype.It=function(){return!1},t}(),Dt=function(){function t(e,n){void 0===n&&(n=t.EMPTY_NODE),this.At=e,this.Lt=n}return t.prototype.insert=function(e,n){return new t(this.At,this.Lt.insert(e,n,this.At).copy(null,null,Pt.BLACK,null,null))},t.prototype.remove=function(e){return new t(this.At,this.Lt.remove(e,this.At).copy(null,null,Pt.BLACK,null,null))},t.prototype.get=function(t){for(var e,n=this.Lt;!n.isEmpty();){if(0===(e=this.At(t,n.key)))return n.value;e<0?n=n.left:e>0&&(n=n.right)}return null},t.prototype.getPredecessorKey=function(t){for(var e,n=this.Lt,r=null;!n.isEmpty();){if(0===(e=this.At(t,n.key))){if(n.left.isEmpty())return r?r.key:null;for(n=n.left;!n.right.isEmpty();)n=n.right;return n.key}e<0?n=n.left:e>0&&(r=n,n=n.right)}throw Error("Attempted to find predecessor key for a nonexistent key.  What gives?")},t.prototype.isEmpty=function(){return this.Lt.isEmpty()},t.prototype.count=function(){return this.Lt.count()},t.prototype.minKey=function(){return this.Lt.minKey()},t.prototype.maxKey=function(){return this.Lt.maxKey()},t.prototype.inorderTraversal=function(t){return this.Lt.inorderTraversal(t)},t.prototype.reverseTraversal=function(t){return this.Lt.reverseTraversal(t)},t.prototype.getIterator=function(t){return new It(this.Lt,null,this.At,!1,t)},t.prototype.getIteratorFrom=function(t,e){return new It(this.Lt,t,this.At,!1,e)},t.prototype.getReverseIteratorFrom=function(t,e){return new It(this.Lt,t,this.At,!0,e)},t.prototype.getReverseIterator=function(t){return new It(this.Lt,null,this.At,!0,t)},t.EMPTY_NODE=new Rt,t}(),jt=Math.log(2),xt=function(){function t(t){this.count=function(t){return parseInt(Math.log(t)/jt,10)}(t+1),this.Mt=this.count-1;var e=function(t){return parseInt(Array(t+1).join("1"),2)}(this.count);this.Wt=t+1&e}return t.prototype.nextBitIsOne=function(){var t=!(this.Wt&1<<this.Mt);return this.Mt--,t},t}(),kt=function(t,e,n,r){t.sort(e);var i=function e(r,i){var o,s,a=i-r;if(0==a)return null;if(1==a)return o=t[r],s=n?n(o):o,new Pt(s,o.node,Pt.BLACK,null,null);var u=parseInt(a/2,10)+r,c=e(r,u),h=e(u+1,i);return o=t[u],s=n?n(o):o,new Pt(s,o.node,Pt.BLACK,c,h)},o=new xt(t.length),s=function(e){for(var r=null,o=null,s=t.length,a=function(e,r){var o=s-e,a=s;s-=e;var c=i(o+1,a),h=t[o],l=n?n(h):h;u(new Pt(l,h.node,r,null,c))},u=function(t){r?(r.left=t,r=t):(o=t,r=t)},c=0;c<e.count;++c){var h=e.nextBitIsOne(),l=Math.pow(2,e.count-(c+1));h?a(l,Pt.BLACK):(a(l,Pt.BLACK),a(l,Pt.RED))}return o}(o);return new Dt(r||e,s)},Ft=n(0),At=n(2),Lt={},Mt=function(){function t(t,e){this.qt=t,this.Qt=e}return Object.defineProperty(t,"Default",{get:function(){return Object(Ft.a)(Lt&&Nt,"ChildrenNode.ts has not been loaded"),d=d||new t({".priority":Lt},{".priority":Nt})},enumerable:!0,configurable:!0}),t.prototype.get=function(t){var e=Object(At.l)(this.qt,t);if(!e)throw Error("No index defined for "+t);return e===Lt?null:e},t.prototype.hasIndex=function(t){return Object(At.b)(this.Qt,""+t)},t.prototype.addIndex=function(e,n){Object(Ft.a)(e!==dt,"KeyIndex always exists and isn't meant to be added to the IndexMap.");for(var r=[],i=!1,o=n.getIterator(st.Wrap),s=o.getNext();s;)i=i||e.isDefinedOn(s.node),r.push(s),s=o.getNext();var a;a=i?kt(r,e.getCompare()):Lt;var u=""+e,c=Object(At.a)(this.Qt);c[u]=e;var h=Object(At.a)(this.qt);return h[u]=a,new t(h,c)},t.prototype.addToIndexes=function(e,n){var r=this;return new t(Object(At.k)(this.qt,function(t,i){var o=Object(At.l)(r.Qt,i);if(Object(Ft.a)(o,"Missing index implementation for "+i),t===Lt){if(o.isDefinedOn(e.node)){for(var s=[],a=n.getIterator(st.Wrap),u=a.getNext();u;)u.name!=e.name&&s.push(u),u=a.getNext();return s.push(e),kt(s,o.getCompare())}return Lt}var c=n.get(e.name),h=t;return c&&(h=h.remove(new st(e.name,c))),h.insert(e,e.node)}),this.Qt)},t.prototype.removeFromIndexes=function(e,n){return new t(Object(At.k)(this.qt,function(t){if(t===Lt)return t;var r=n.get(e.name);return r?t.remove(new st(e.name,r)):t}),this.Qt)},t}(),Wt=n(1),qt=n(0),Qt=n(1),Ut=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),Vt=function(){function t(t,e,n){this.Ut=t,this.mt=e,this.Vt=n,this.bt=null,this.mt&&mt(this.mt),this.Ut.isEmpty()&&Object(qt.a)(!this.mt||this.mt.isEmpty(),"An empty node cannot have a priority")}return Object.defineProperty(t,"EMPTY_NODE",{get:function(){return f||(f=new t(new Dt(s),null,Mt.Default))},enumerable:!0,configurable:!0}),t.prototype.isLeafNode=function(){return!1},t.prototype.getPriority=function(){return this.mt||f},t.prototype.updatePriority=function(e){return this.Ut.isEmpty()?this:new t(this.Ut,e,this.Vt)},t.prototype.getImmediateChild=function(t){if(".priority"===t)return this.getPriority();var e=this.Ut.get(t);return null===e?f:e},t.prototype.getChild=function(t){var e=t.getFront();return null===e?this:this.getImmediateChild(e).getChild(t.popFront())},t.prototype.hasChild=function(t){return null!==this.Ut.get(t)},t.prototype.updateImmediateChild=function(e,n){if(Object(qt.a)(n,"We should always be passing snapshot nodes"),".priority"===e)return this.updatePriority(n);var r=new st(e,n),i=void 0,o=void 0,s=void 0;return n.isEmpty()?(i=this.Ut.remove(e),o=this.Vt.removeFromIndexes(r,this.Ut)):(i=this.Ut.insert(e,n),o=this.Vt.addToIndexes(r,this.Ut)),s=i.isEmpty()?f:this.mt,new t(i,s,o)},t.prototype.updateChild=function(t,e){var n=t.getFront();if(null===n)return e;Object(qt.a)(".priority"!==t.getFront()||1===t.getLength(),".priority must be the last token in a path");var r=this.getImmediateChild(n).updateChild(t.popFront(),e);return this.updateImmediateChild(n,r)},t.prototype.isEmpty=function(){return this.Ut.isEmpty()},t.prototype.numChildren=function(){return this.Ut.count()},t.prototype.val=function(e){if(this.isEmpty())return null;var n={},r=0,i=0,o=!0;if(this.forEachChild(Nt,function(s,a){n[s]=a.val(e),r++,o&&t.Bt.test(s)?i=Math.max(i,+s):o=!1}),!e&&o&&i<2*r){var s=[];for(var a in n)s[a]=n[a];return s}return e&&!this.getPriority().isEmpty()&&(n[".priority"]=this.getPriority().val()),n},t.prototype.hash=function(){if(null===this.bt){var t="";this.getPriority().isEmpty()||(t+="priority:"+gt(this.getPriority().val())+":"),this.forEachChild(Nt,function(e,n){var r=n.hash();""!==r&&(t+=":"+e+":"+r)}),this.bt=""===t?"":Object(Qt.y)(t)}return this.bt},t.prototype.getPredecessorChildName=function(t,e,n){var r=this.Ht(n);if(r){var i=r.getPredecessorKey(new st(t,e));return i?i.name:null}return this.Ut.getPredecessorKey(t)},t.prototype.getFirstChildName=function(t){var e=this.Ht(t);if(e){var n=e.minKey();return n&&n.name}return this.Ut.minKey()},t.prototype.getFirstChild=function(t){var e=this.getFirstChildName(t);return e?new st(e,this.Ut.get(e)):null},t.prototype.getLastChildName=function(t){var e=this.Ht(t);if(e){var n=e.maxKey();return n&&n.name}return this.Ut.maxKey()},t.prototype.getLastChild=function(t){var e=this.getLastChildName(t);return e?new st(e,this.Ut.get(e)):null},t.prototype.forEachChild=function(t,e){var n=this.Ht(t);return n?n.inorderTraversal(function(t){return e(t.name,t.node)}):this.Ut.inorderTraversal(e)},t.prototype.getIterator=function(t){return this.getIteratorFrom(t.minPost(),t)},t.prototype.getIteratorFrom=function(t,e){var n=this.Ht(e);if(n)return n.getIteratorFrom(t,function(t){return t});for(var r=this.Ut.getIteratorFrom(t.name,st.Wrap),i=r.peek();null!=i&&e.compare(i,t)<0;)r.getNext(),i=r.peek();return r},t.prototype.getReverseIterator=function(t){return this.getReverseIteratorFrom(t.maxPost(),t)},t.prototype.getReverseIteratorFrom=function(t,e){var n=this.Ht(e);if(n)return n.getReverseIteratorFrom(t,function(t){return t});for(var r=this.Ut.getReverseIteratorFrom(t.name,st.Wrap),i=r.peek();null!=i&&e.compare(i,t)>0;)r.getNext(),i=r.peek();return r},t.prototype.compareTo=function(t){return this.isEmpty()?t.isEmpty()?0:-1:t.isLeafNode()||t.isEmpty()?1:t===Ht?-1:0},t.prototype.withIndex=function(e){if(e===dt||this.Vt.hasIndex(e))return this;var n=this.Vt.addIndex(e,this.Ut);return new t(this.Ut,this.mt,n)},t.prototype.isIndexed=function(t){return t===dt||this.Vt.hasIndex(t)},t.prototype.equals=function(t){if(t===this)return!0;if(t.isLeafNode())return!1;var e=t;if(this.getPriority().equals(e.getPriority())){if(this.Ut.count()===e.Ut.count()){for(var n=this.getIterator(Nt),r=e.getIterator(Nt),i=n.getNext(),o=r.getNext();i&&o;){if(i.name!==o.name||!i.node.equals(o.node))return!1;i=n.getNext(),o=r.getNext()}return null===i&&null===o}return!1}return!1},t.prototype.Ht=function(t){return t===dt?null:this.Vt.get(""+t)},t.Bt=/^(0|[1-9]\d*)$/,t}(),Bt=function(t){function e(){return t.call(this,new Dt(s),Vt.EMPTY_NODE,Mt.Default)||this}return Ut(e,t),e.prototype.compareTo=function(t){return t===this?0:1},e.prototype.equals=function(t){return t===this},e.prototype.getPriority=function(){return this},e.prototype.getImmediateChild=function(t){return Vt.EMPTY_NODE},e.prototype.isEmpty=function(){return!1},e}(Vt),Ht=new Bt;Object.defineProperties(st,{MIN:{value:new st(Qt.c,Vt.EMPTY_NODE)},MAX:{value:new st(Qt.b,Ht)}}),pt.Kt=Vt.EMPTY_NODE,wt.vt=Vt,function(t){c=t}(Ht),function(t){p=t}(Ht);var Kt=n(2),Yt=n(0),zt="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Gt=!0;!function(t){l=t}(a);var Xt,$t,Jt=n(1),Zt=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),te=function(t){function e(){return null!==t&&t.apply(this,arguments)||this}return Zt(e,t),e.prototype.compare=function(t,e){var n=t.node.compareTo(e.node);return 0===n?Object(Jt.v)(t.name,e.name):n},e.prototype.isDefinedOn=function(t){return!0},e.prototype.indexedValueChanged=function(t,e){return!t.equals(e)},e.prototype.minPost=function(){return st.MIN},e.prototype.maxPost=function(){return st.MAX},e.prototype.makePost=function(t,e){var n=a(t);return new st(e,n)},e.prototype.toString=function(){return".value"},e}(ut),ee=new te,ne=n(0),re=n(1),ie=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),oe=function(t){function e(e){var n=t.call(this)||this;return n.Yt=e,Object(ne.a)(!e.isEmpty()&&".priority"!==e.getFront(),"Can't create PathIndex with empty path or .priority key"),n}return ie(e,t),e.prototype.extractChild=function(t){return t.getChild(this.Yt)},e.prototype.isDefinedOn=function(t){return!t.getChild(this.Yt).isEmpty()},e.prototype.compare=function(t,e){var n=this.extractChild(t.node),r=this.extractChild(e.node),i=n.compareTo(r);return 0===i?Object(re.v)(t.name,e.name):i},e.prototype.makePost=function(t,e){var n=a(t),r=Vt.EMPTY_NODE.updateChild(this.Yt,n);return new st(e,r)},e.prototype.maxPost=function(){var t=Vt.EMPTY_NODE.updateChild(this.Yt,Ht);return new st(re.b,t)},e.prototype.toString=function(){return this.Yt.slice().join("/")},e}(ut),se=function(){function t(t,e,n){this.zt=t,this.Gt=e,this.Xt=n}return t.prototype.val=function(){return P("DataSnapshot.val",0,0,arguments.length),this.zt.val()},t.prototype.exportVal=function(){return P("DataSnapshot.exportVal",0,0,arguments.length),this.zt.val(!0)},t.prototype.toJSON=function(){return P("DataSnapshot.toJSON",0,1,arguments.length),this.exportVal()},t.prototype.exists=function(){return P("DataSnapshot.exists",0,0,arguments.length),!this.zt.isEmpty()},t.prototype.child=function(e){P("DataSnapshot.child",0,1,arguments.length),e+="",G("DataSnapshot.child",1,e,!1);var n=new v(e),r=this.Gt.child(n);return new t(this.zt.getChild(n),r,Nt)},t.prototype.hasChild=function(t){P("DataSnapshot.hasChild",1,1,arguments.length),G("DataSnapshot.hasChild",1,t,!1);var e=new v(t);return!this.zt.getChild(e).isEmpty()},t.prototype.getPriority=function(){return P("DataSnapshot.getPriority",0,0,arguments.length),this.zt.getPriority().val()},t.prototype.forEach=function(e){var n=this;return P("DataSnapshot.forEach",1,1,arguments.length),R("DataSnapshot.forEach",1,e,!1),!this.zt.isLeafNode()&&!!this.zt.forEachChild(this.Xt,function(r,i){return e(new t(i,n.Gt.child(r),Nt))})},t.prototype.hasChildren=function(){return P("DataSnapshot.hasChildren",0,0,arguments.length),!this.zt.isLeafNode()&&!this.zt.isEmpty()},Object.defineProperty(t.prototype,"key",{get:function(){return this.Gt.getKey()},enumerable:!0,configurable:!0}),t.prototype.numChildren=function(){return P("DataSnapshot.numChildren",0,0,arguments.length),this.zt.numChildren()},t.prototype.getRef=function(){return P("DataSnapshot.ref",0,0,arguments.length),this.Gt},Object.defineProperty(t.prototype,"ref",{get:function(){return this.getRef()},enumerable:!0,configurable:!0}),t}(),ae=n(3),ue=function(){function t(t,e,n,r){this.eventType=t,this.eventRegistration=e,this.snapshot=n,this.prevName=r}return t.prototype.getPath=function(){var t=this.snapshot.getRef();return"value"===this.eventType?t.path:t.getParent().path},t.prototype.getEventType=function(){return this.eventType},t.prototype.getEventRunner=function(){return this.eventRegistration.getEventRunner(this)},t.prototype.toString=function(){return this.getPath()+":"+this.eventType+":"+Object(ae.b)(this.snapshot.exportVal())},t}(),ce=function(){function t(t,e,n){this.eventRegistration=t,this.error=e,this.path=n}return t.prototype.getPath=function(){return this.path},t.prototype.getEventType=function(){return"cancel"},t.prototype.getEventRunner=function(){return this.eventRegistration.getEventRunner(this)},t.prototype.toString=function(){return this.path+":cancel"},t}(),he=n(2),le=n(0),pe=function(){function t(t,e,n){this.$t=t,this.Jt=e,this.Zt=n}return t.prototype.respondsTo=function(t){return"value"===t},t.prototype.createEvent=function(t,e){var n=e.getQueryParams().getIndex();return new ue("value",this,new se(t.snapshotNode,e.getRef(),n))},t.prototype.getEventRunner=function(t){var e=this.Zt;if("cancel"===t.getEventType()){Object(le.a)(this.Jt,"Raising a cancel event on a listener with no cancel callback");var n=this.Jt;return function(){n.call(e,t.error)}}var r=this.$t;return function(){r.call(e,t.snapshot)}},t.prototype.createCancelEvent=function(t,e){return this.Jt?new ce(this,t,e):null},t.prototype.matches=function(e){return e instanceof t&&(!e.$t||!this.$t||e.$t===this.$t&&e.Zt===this.Zt)},t.prototype.hasAnyCallback=function(){return null!==this.$t},t}(),de=function(){function t(t,e,n){this.te=t,this.Jt=e,this.Zt=n}return t.prototype.respondsTo=function(t){var e="children_added"===t?"child_added":t;return e="children_removed"===e?"child_removed":e,Object(he.b)(this.te,e)},t.prototype.createCancelEvent=function(t,e){return this.Jt?new ce(this,t,e):null},t.prototype.createEvent=function(t,e){Object(le.a)(null!=t.childName,"Child events should have a childName.");var n=e.getRef().child(t.childName),r=e.getQueryParams().getIndex();return new ue(t.type,this,new se(t.snapshotNode,n,r),t.prevName)},t.prototype.getEventRunner=function(t){var e=this.Zt;if("cancel"===t.getEventType()){Object(le.a)(this.Jt,"Raising a cancel event on a listener with no cancel callback");var n=this.Jt;return function(){n.call(e,t.error)}}var r=this.te[t.eventType];return function(){r.call(e,t.snapshot,t.prevName)}},t.prototype.matches=function(e){if(e instanceof t){if(!this.te||!e.te)return!0;if(this.Zt===e.Zt){var n=Object(he.h)(e.te);if(n===Object(he.h)(this.te)){if(1===n){var r=Object(he.g)(e.te),i=Object(he.g)(this.te);return!(i!==r||e.te[r]&&this.te[i]&&e.te[r]!==this.te[i])}return Object(he.c)(this.te,function(t,n){return e.te[t]===n})}}}return!1},t.prototype.hasAnyCallback=function(){return null!==this.te},t}(),fe=n(0),_e=n(1),ye=n(4),ve="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},ge=function(){function t(t,e,n,r){this.repo=t,this.path=e,this.ee=n,this.ne=r}return Object.defineProperty(t,"__referenceConstructor",{get:function(){return Object(fe.a)(Xt,"Reference.ts has not been loaded"),Xt},set:function(t){Xt=t},enumerable:!0,configurable:!0}),t.re=function(t){var e=null,n=null;if(t.hasStart()&&(e=t.getIndexStartValue()),t.hasEnd()&&(n=t.getIndexEndValue()),t.getIndex()===dt){var r="Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().",i="Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.";if(t.hasStart()){if(t.getIndexStartName()!=_e.c)throw Error(r);if("string"!=typeof e)throw Error(i)}if(t.hasEnd()){if(t.getIndexEndName()!=_e.b)throw Error(r);if("string"!=typeof n)throw Error(i)}}else if(t.getIndex()===Nt){if(null!=e&&!Q(e)||null!=n&&!Q(n))throw Error("Query: When ordering by priority, the first argument passed to startAt(), endAt(), or equalTo() must be a valid priority value (null, a number, or a string).")}else if(Object(fe.a)(t.getIndex()instanceof oe||t.getIndex()===ee,"unknown index type."),null!=e&&"object"===(void 0===e?"undefined":ve(e))||null!=n&&"object"===(void 0===n?"undefined":ve(n)))throw Error("Query: First argument passed to startAt(), endAt(), or equalTo() cannot be an object.")},t.ie=function(t){if(t.hasStart()&&t.hasEnd()&&t.hasLimit()&&!t.hasAnchoredLimit())throw Error("Query: Can't combine startAt(), endAt(), and limit(). Use limitToFirst() or limitToLast() instead.")},t.prototype.oe=function(t){if(!0===this.ne)throw Error(t+": You can't combine multiple orderBy calls.")},t.prototype.getQueryParams=function(){return this.ee},t.prototype.getRef=function(){return P("Query.ref",0,0,arguments.length),new t.se(this.repo,this.path)},t.prototype.on=function(e,n,r,i){P("Query.on",2,4,arguments.length),Y("Query.on",1,e,!1),R("Query.on",2,n,!1);var o=t.ae("Query.on",r,i);if("value"===e)this.onValueEvent(n,o.cancel,o.context);else{var s={};s[e]=n,this.onChildEvent(s,o.cancel,o.context)}return n},t.prototype.onValueEvent=function(t,e,n){var r=new pe(t,e||null,n||null);this.repo.addEventCallbackForQuery(this,r)},t.prototype.onChildEvent=function(t,e,n){var r=new de(t,e,n);this.repo.addEventCallbackForQuery(this,r)},t.prototype.off=function(t,e,n){P("Query.off",0,3,arguments.length),Y("Query.off",1,t,!0),R("Query.off",2,e,!0),D("Query.off",3,n,!0);var r=null,i=null;"value"===t?r=new pe(e||null,null,n||null):t&&(e&&(i={},i[t]=e),r=new de(i,null,n||null)),this.repo.removeEventCallbackForQuery(this,r)},t.prototype.once=function(e,n,r,i){var o=this;P("Query.once",1,4,arguments.length),Y("Query.once",1,e,!1),R("Query.once",2,n,!0);var s=t.ae("Query.once",r,i),a=!0,u=new ye.a;Object(ye.c)(u.promise);var c=function t(r){a&&(a=!1,o.off(e,t),n&&n.bind(s.context)(r),u.resolve(r))};return this.on(e,c,function(t){o.off(e,c),s.cancel&&s.cancel.bind(s.context)(t),u.reject(t)}),u.promise},t.prototype.limitToFirst=function(e){if(P("Query.limitToFirst",1,1,arguments.length),"number"!=typeof e||Math.floor(e)!==e||e<=0)throw Error("Query.limitToFirst: First argument must be a positive integer.");if(this.ee.hasLimit())throw Error("Query.limitToFirst: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new t(this.repo,this.path,this.ee.limitToFirst(e),this.ne)},t.prototype.limitToLast=function(e){if(P("Query.limitToLast",1,1,arguments.length),"number"!=typeof e||Math.floor(e)!==e||e<=0)throw Error("Query.limitToLast: First argument must be a positive integer.");if(this.ee.hasLimit())throw Error("Query.limitToLast: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new t(this.repo,this.path,this.ee.limitToLast(e),this.ne)},t.prototype.orderByChild=function(e){if(P("Query.orderByChild",1,1,arguments.length),"$key"===e)throw Error('Query.orderByChild: "$key" is invalid.  Use Query.orderByKey() instead.');if("$priority"===e)throw Error('Query.orderByChild: "$priority" is invalid.  Use Query.orderByPriority() instead.');if("$value"===e)throw Error('Query.orderByChild: "$value" is invalid.  Use Query.orderByValue() instead.');G("Query.orderByChild",1,e,!1),this.oe("Query.orderByChild");var n=new v(e);if(n.isEmpty())throw Error("Query.orderByChild: cannot pass in empty path.  Use Query.orderByValue() instead.");var r=new oe(n),i=this.ee.orderBy(r);return t.re(i),new t(this.repo,this.path,i,!0)},t.prototype.orderByKey=function(){P("Query.orderByKey",0,0,arguments.length),this.oe("Query.orderByKey");var e=this.ee.orderBy(dt);return t.re(e),new t(this.repo,this.path,e,!0)},t.prototype.orderByPriority=function(){P("Query.orderByPriority",0,0,arguments.length),this.oe("Query.orderByPriority");var e=this.ee.orderBy(Nt);return t.re(e),new t(this.repo,this.path,e,!0)},t.prototype.orderByValue=function(){P("Query.orderByValue",0,0,arguments.length),this.oe("Query.orderByValue");var e=this.ee.orderBy(ee);return t.re(e),new t(this.repo,this.path,e,!0)},t.prototype.startAt=function(e,n){void 0===e&&(e=null),P("Query.startAt",0,2,arguments.length),U("Query.startAt",1,e,this.path,!0),z("Query.startAt",2,n,!0);var r=this.ee.startAt(e,n);if(t.ie(r),t.re(r),this.ee.hasStart())throw Error("Query.startAt: Starting point was already set (by another call to startAt or equalTo).");return void 0===e&&(e=null,n=null),new t(this.repo,this.path,r,this.ne)},t.prototype.endAt=function(e,n){void 0===e&&(e=null),P("Query.endAt",0,2,arguments.length),U("Query.endAt",1,e,this.path,!0),z("Query.endAt",2,n,!0);var r=this.ee.endAt(e,n);if(t.ie(r),t.re(r),this.ee.hasEnd())throw Error("Query.endAt: Ending point was already set (by another call to endAt or equalTo).");return new t(this.repo,this.path,r,this.ne)},t.prototype.equalTo=function(t,e){if(P("Query.equalTo",1,2,arguments.length),U("Query.equalTo",1,t,this.path,!1),z("Query.equalTo",2,e,!0),this.ee.hasStart())throw Error("Query.equalTo: Starting point was already set (by another call to startAt or equalTo).");if(this.ee.hasEnd())throw Error("Query.equalTo: Ending point was already set (by another call to endAt or equalTo).");return this.startAt(t,e).endAt(t,e)},t.prototype.toString=function(){return P("Query.toString",0,0,arguments.length),""+this.repo+this.path.toUrlEncodedString()},t.prototype.toJSON=function(){return P("Query.toJSON",0,1,arguments.length),""+this},t.prototype.queryObject=function(){return this.ee.getQueryObject()},t.prototype.queryIdentifier=function(){var t=this.queryObject(),e=Object(_e.d)(t);return"{}"===e?"default":e},t.prototype.isEqual=function(e){if(P("Query.isEqual",1,1,arguments.length),!(e instanceof t))throw Error("Query.isEqual failed: First argument must be an instance of firebase.database.Query.");var n=this.repo===e.repo,r=this.path.equals(e.path),i=this.queryIdentifier()===e.queryIdentifier();return n&&r&&i},t.ae=function(t,e,n){var r={cancel:null,context:null};if(e&&n)r.cancel=e,R(t,3,r.cancel,!0),r.context=n,D(t,4,r.context,!0);else if(e)if("object"===(void 0===e?"undefined":ve(e))&&null!==e)r.context=e;else{if("function"!=typeof e)throw Error(i(t,3,!0)+" must either be a cancel callback or a context object.");r.cancel=e}return r},Object.defineProperty(t.prototype,"ref",{get:function(){return this.getRef()},enumerable:!0,configurable:!0}),t}(),me=n(2),be=function(){function t(){this.set={}}return t.prototype.add=function(t,e){this.set[t]=null===e||e},t.prototype.contains=function(t){return Object(me.b)(this.set,t)},t.prototype.get=function(t){return this.contains(t)?this.set[t]:void 0},t.prototype.remove=function(t){delete this.set[t]},t.prototype.clear=function(){this.set={}},t.prototype.isEmpty=function(){return Object(me.j)(this.set)},t.prototype.count=function(){return Object(me.h)(this.set)},t.prototype.each=function(t){Object(me.f)(this.set,function(e,n){return t(e,n)})},t.prototype.keys=function(){var t=[];return Object(me.f)(this.set,function(e){t.push(e)}),t},t}(),Ce=function(){function t(){this.gt=null,this.Ut=null}return t.prototype.find=function(t){if(null!=this.gt)return this.gt.getChild(t);if(t.isEmpty()||null==this.Ut)return null;var e=t.getFront();return t=t.popFront(),this.Ut.contains(e)?this.Ut.get(e).find(t):null},t.prototype.remember=function(e,n){if(e.isEmpty())this.gt=n,this.Ut=null;else if(null!==this.gt)this.gt=this.gt.updateChild(e,n);else{null==this.Ut&&(this.Ut=new be);var r=e.getFront();this.Ut.contains(r)||this.Ut.add(r,new t);var i=this.Ut.get(r);e=e.popFront(),i.remember(e,n)}},t.prototype.forget=function(t){if(t.isEmpty())return this.gt=null,this.Ut=null,!0;if(null!==this.gt){if(this.gt.isLeafNode())return!1;var e=this.gt;this.gt=null;var n=this;return e.forEachChild(Nt,function(t,e){n.remember(new v(t),e)}),this.forget(t)}if(null!==this.Ut){var r=t.getFront();return t=t.popFront(),this.Ut.contains(r)&&this.Ut.get(r).forget(t)&&this.Ut.remove(r),!!this.Ut.isEmpty()&&(this.Ut=null,!0)}return!0},t.prototype.forEachTree=function(t,e){null!==this.gt?e(t,this.gt):this.forEachChild(function(n,r){var i=new v(t+"/"+n);r.forEachTree(i,e)})},t.prototype.forEachChild=function(t){null!==this.Ut&&this.Ut.each(function(e,n){t(e,n)})},t}(),Ee=n(0),we="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Oe=function(t){return t=t||{},t.timestamp=t.timestamp||(new Date).getTime(),t},Se=function(t,e){return t&&"object"===(void 0===t?"undefined":we(t))?(Object(Ee.a)(".sv"in t,"Unexpected leaf node or priority contents"),e[t[".sv"]]):t},Te=function(t,e){var n=new Ce;return t.forEachTree(new v(""),function(t,r){n.remember(t,Ne(r,e))}),n},Ne=function t(e,n){var r,i=e.getPriority().val(),o=Se(i,n);if(e.isLeafNode()){var s=e,u=Se(s.getValue(),n);return u!==s.getValue()||o!==s.getPriority().val()?new wt(u,a(o)):e}var c=e;return r=c,o!==c.getPriority().val()&&(r=r.updatePriority(new wt(o))),c.forEachChild(Nt,function(e,i){var o=t(i,n);o!==i&&(r=r.updateImmediateChild(e,o))}),r},Ie=n(0);!function(t){t[t.OVERWRITE=0]="OVERWRITE",t[t.MERGE=1]="MERGE",t[t.ACK_USER_WRITE=2]="ACK_USER_WRITE",t[t.LISTEN_COMPLETE=3]="LISTEN_COMPLETE"}($t||($t={}));var Pe,Re,De=function(){function t(t,e,n,r){this.fromUser=t,this.fromServer=e,this.queryId=n,this.tagged=r,Object(Ie.a)(!r||e,"Tagged queries must be from server.")}return t.User=new t(!0,!1,null,!1),t.Server=new t(!1,!0,null,!1),t.forServerTaggedQuery=function(e){return new t(!1,!0,e,!0)},t}(),je=n(0),xe=function(){function t(t,e,n){this.path=t,this.affectedTree=e,this.revert=n,this.type=$t.ACK_USER_WRITE,this.source=De.User}return t.prototype.operationForChild=function(e){if(this.path.isEmpty()){if(null!=this.affectedTree.value)return Object(je.a)(this.affectedTree.children.isEmpty(),"affectedTree should not have overlapping affected paths."),this;var n=this.affectedTree.subtree(new v(e));return new t(v.Empty,n,this.revert)}return Object(je.a)(this.path.getFront()===e,"operationForChild called for unrelated child."),new t(this.path.popFront(),this.affectedTree,this.revert)},t}(),ke=n(1),Fe=n(2),Ae=function(){return Pe||(Pe=new Dt(ke.A)),Pe},Le=function(){function t(t,e){void 0===e&&(e=Ae()),this.value=t,this.children=e}return t.fromObject=function(e){var n=t.Empty;return Object(Fe.f)(e,function(t,e){n=n.set(new v(t),e)}),n},t.prototype.isEmpty=function(){return null===this.value&&this.children.isEmpty()},t.prototype.findRootMostMatchingPathAndValue=function(t,e){if(null!=this.value&&e(this.value))return{path:v.Empty,value:this.value};if(t.isEmpty())return null;var n=t.getFront(),r=this.children.get(n);if(null!==r){var i=r.findRootMostMatchingPathAndValue(t.popFront(),e);return null!=i?{path:new v(n).child(i.path),value:i.value}:null}return null},t.prototype.findRootMostValueAndPath=function(t){return this.findRootMostMatchingPathAndValue(t,function(){return!0})},t.prototype.subtree=function(e){if(e.isEmpty())return this;var n=e.getFront(),r=this.children.get(n);return null!==r?r.subtree(e.popFront()):t.Empty},t.prototype.set=function(e,n){if(e.isEmpty())return new t(n,this.children);var r=e.getFront(),i=this.children.get(r)||t.Empty,o=i.set(e.popFront(),n),s=this.children.insert(r,o);return new t(this.value,s)},t.prototype.remove=function(e){if(e.isEmpty())return this.children.isEmpty()?t.Empty:new t(null,this.children);var n=e.getFront(),r=this.children.get(n);if(r){var i=r.remove(e.popFront()),o=void 0;return o=i.isEmpty()?this.children.remove(n):this.children.insert(n,i),null===this.value&&o.isEmpty()?t.Empty:new t(this.value,o)}return this},t.prototype.get=function(t){if(t.isEmpty())return this.value;var e=t.getFront(),n=this.children.get(e);return n?n.get(t.popFront()):null},t.prototype.setTree=function(e,n){if(e.isEmpty())return n;var r=e.getFront(),i=this.children.get(r)||t.Empty,o=i.setTree(e.popFront(),n),s=void 0;return s=o.isEmpty()?this.children.remove(r):this.children.insert(r,o),new t(this.value,s)},t.prototype.fold=function(t){return this.ue(v.Empty,t)},t.prototype.ue=function(t,e){var n={};return this.children.inorderTraversal(function(r,i){n[r]=i.ue(t.child(r),e)}),e(t,this.value,n)},t.prototype.findOnPath=function(t,e){return this.ce(t,v.Empty,e)},t.prototype.ce=function(t,e,n){var r=!!this.value&&n(e,this.value);if(r)return r;if(t.isEmpty())return null;var i=t.getFront(),o=this.children.get(i);return o?o.ce(t.popFront(),e.child(i),n):null},t.prototype.foreachOnPath=function(t,e){return this.he(t,v.Empty,e)},t.prototype.he=function(e,n,r){if(e.isEmpty())return this;this.value&&r(n,this.value);var i=e.getFront(),o=this.children.get(i);return o?o.he(e.popFront(),n.child(i),r):t.Empty},t.prototype.foreach=function(t){this.le(v.Empty,t)},t.prototype.le=function(t,e){this.children.inorderTraversal(function(n,r){r.le(t.child(n),e)}),this.value&&e(t,this.value)},t.prototype.foreachChild=function(t){this.children.inorderTraversal(function(e,n){n.value&&t(e,n.value)})},t.Empty=new t(null),t}(),Me=function(){function t(t,e){this.source=t,this.path=e,this.type=$t.LISTEN_COMPLETE}return t.prototype.operationForChild=function(e){return this.path.isEmpty()?new t(this.source,v.Empty):new t(this.source,this.path.popFront())},t}(),We=function(){function t(t,e,n){this.source=t,this.path=e,this.snap=n,this.type=$t.OVERWRITE}return t.prototype.operationForChild=function(e){return this.path.isEmpty()?new t(this.source,v.Empty,this.snap.getImmediateChild(e)):new t(this.source,this.path.popFront(),this.snap)},t}(),qe=n(0),Qe=function(){function t(t,e,n){this.source=t,this.path=e,this.children=n,this.type=$t.MERGE}return t.prototype.operationForChild=function(e){if(this.path.isEmpty()){var n=this.children.subtree(new v(e));return n.isEmpty()?null:n.value?new We(this.source,v.Empty,n.value):new t(this.source,v.Empty,n)}return Object(qe.a)(this.path.getFront()===e,"Can't get a merge for a child not on the path of the operation"),new t(this.source,this.path.popFront(),this.children)},t.prototype.toString=function(){return"Operation("+this.path+": "+this.source+" merge: "+this.children+")"},t}(),Ue=function(){function t(t,e,n){this.zt=t,this.pe=e,this.de=n}return t.prototype.isFullyInitialized=function(){return this.pe},t.prototype.isFiltered=function(){return this.de},t.prototype.isCompleteForPath=function(t){if(t.isEmpty())return this.isFullyInitialized()&&!this.de;var e=t.getFront();return this.isCompleteForChild(e)},t.prototype.isCompleteForChild=function(t){return this.isFullyInitialized()&&!this.de||this.zt.hasChild(t)},t.prototype.getNode=function(){return this.zt},t}(),Ve=function(){function t(t,e){this.fe=t,this._e=e}return t.prototype.updateEventSnap=function(e,n,r){return new t(new Ue(e,n,r),this._e)},t.prototype.updateServerSnap=function(e,n,r){return new t(this.fe,new Ue(e,n,r))},t.prototype.getEventCache=function(){return this.fe},t.prototype.getCompleteEventSnap=function(){return this.fe.isFullyInitialized()?this.fe.getNode():null},t.prototype.getServerCache=function(){return this._e},t.prototype.getCompleteServerSnap=function(){return this._e.isFullyInitialized()?this._e.getNode():null},t.Empty=new t(new Ue(Vt.EMPTY_NODE,!1,!1),new Ue(Vt.EMPTY_NODE,!1,!1)),t}(),Be=function(){function t(t,e,n,r,i){this.type=t,this.snapshotNode=e,this.childName=n,this.oldSnap=r,this.prevName=i}return t.valueChange=function(e){return new t(t.VALUE,e)},t.childAddedChange=function(e,n){return new t(t.CHILD_ADDED,n,e)},t.childRemovedChange=function(e,n){return new t(t.CHILD_REMOVED,n,e)},t.childChangedChange=function(e,n,r){return new t(t.CHILD_CHANGED,n,e,r)},t.childMovedChange=function(e,n){return new t(t.CHILD_MOVED,n,e)},t.CHILD_ADDED="child_added",t.CHILD_REMOVED="child_removed",t.CHILD_CHANGED="child_changed",t.CHILD_MOVED="child_moved",t.VALUE="value",t}(),He=n(0),Ke=function(){function t(t){this.Xt=t}return t.prototype.updateChild=function(t,e,n,r,i,o){Object(He.a)(t.isIndexed(this.Xt),"A node must be indexed if only a child is updated");var s=t.getImmediateChild(e);return s.getChild(r).equals(n.getChild(r))&&s.isEmpty()==n.isEmpty()?t:(null!=o&&(n.isEmpty()?t.hasChild(e)?o.trackChildChange(Be.childRemovedChange(e,s)):Object(He.a)(t.isLeafNode(),"A child remove without an old child only makes sense on a leaf node"):s.isEmpty()?o.trackChildChange(Be.childAddedChange(e,n)):o.trackChildChange(Be.childChangedChange(e,n,s))),t.isLeafNode()&&n.isEmpty()?t:t.updateImmediateChild(e,n).withIndex(this.Xt))},t.prototype.updateFullNode=function(t,e,n){return null!=n&&(t.isLeafNode()||t.forEachChild(Nt,function(t,r){e.hasChild(t)||n.trackChildChange(Be.childRemovedChange(t,r))}),e.isLeafNode()||e.forEachChild(Nt,function(e,r){if(t.hasChild(e)){var i=t.getImmediateChild(e);i.equals(r)||n.trackChildChange(Be.childChangedChange(e,r,i))}else n.trackChildChange(Be.childAddedChange(e,r))})),e.withIndex(this.Xt)},t.prototype.updatePriority=function(t,e){return t.isEmpty()?Vt.EMPTY_NODE:t.updatePriority(e)},t.prototype.filtersNodes=function(){return!1},t.prototype.getIndexedFilter=function(){return this},t.prototype.getIndex=function(){return this.Xt},t}(),Ye=n(2),ze=n(0),Ge=function(){function t(){this.ye={}}return t.prototype.trackChildChange=function(t){var e=t.type,n=t.childName;Object(ze.a)(e==Be.CHILD_ADDED||e==Be.CHILD_CHANGED||e==Be.CHILD_REMOVED,"Only child changes supported for tracking"),Object(ze.a)(".priority"!==n,"Only non-priority child changes can be tracked.");var r=Object(Ye.l)(this.ye,n);if(r){var i=r.type;if(e==Be.CHILD_ADDED&&i==Be.CHILD_REMOVED)this.ye[n]=Be.childChangedChange(n,t.snapshotNode,r.snapshotNode);else if(e==Be.CHILD_REMOVED&&i==Be.CHILD_ADDED)delete this.ye[n];else if(e==Be.CHILD_REMOVED&&i==Be.CHILD_CHANGED)this.ye[n]=Be.childRemovedChange(n,r.oldSnap);else if(e==Be.CHILD_CHANGED&&i==Be.CHILD_ADDED)this.ye[n]=Be.childAddedChange(n,t.snapshotNode);else{if(e!=Be.CHILD_CHANGED||i!=Be.CHILD_CHANGED)throw Object(ze.b)("Illegal combination of changes: "+t+" occurred after "+r);this.ye[n]=Be.childChangedChange(n,t.snapshotNode,r.oldSnap)}}else this.ye[n]=t},t.prototype.getChanges=function(){return Object(Ye.i)(this.ye)},t}(),Xe=function(){function t(){}return t.prototype.getCompleteChild=function(t){return null},t.prototype.getChildAfterChild=function(t,e,n){return null},t}(),$e=new Xe,Je=function(){function t(t,e,n){void 0===n&&(n=null),this.ve=t,this.ge=e,this.me=n}return t.prototype.getCompleteChild=function(t){var e=this.ge.getEventCache();if(e.isCompleteForChild(t))return e.getNode().getImmediateChild(t);var n=null!=this.me?new Ue(this.me,!0,!1):this.ge.getServerCache();return this.ve.calcCompleteChild(t,n)},t.prototype.getChildAfterChild=function(t,e,n){var r=null!=this.me?this.me:this.ge.getCompleteServerSnap(),i=this.ve.calcIndexedSlice(r,e,1,n,t);return 0===i.length?null:i[0]},t}(),Ze=n(0),tn=function(){function t(t,e){this.viewCache=t,this.changes=e}return t}(),en=function(){function t(t){this.be=t}return t.prototype.assertIndexed=function(t){Object(Ze.a)(t.getEventCache().getNode().isIndexed(this.be.getIndex()),"Event snap not indexed"),Object(Ze.a)(t.getServerCache().getNode().isIndexed(this.be.getIndex()),"Server snap not indexed")},t.prototype.applyOperation=function(e,n,r,i){var o,s,a=new Ge;if(n.type===$t.OVERWRITE){var u=n;u.source.fromUser?o=this.Ce(e,u.path,u.snap,r,i,a):(Object(Ze.a)(u.source.fromServer,"Unknown source."),s=u.source.tagged||e.getServerCache().isFiltered()&&!u.path.isEmpty(),o=this.Ee(e,u.path,u.snap,r,i,s,a))}else if(n.type===$t.MERGE){var c=n;c.source.fromUser?o=this.we(e,c.path,c.children,r,i,a):(Object(Ze.a)(c.source.fromServer,"Unknown source."),s=c.source.tagged||e.getServerCache().isFiltered(),o=this.Oe(e,c.path,c.children,r,i,s,a))}else if(n.type===$t.ACK_USER_WRITE){var h=n;o=h.revert?this.Se(e,h.path,r,i,a):this.Te(e,h.path,h.affectedTree,r,i,a)}else{if(n.type!==$t.LISTEN_COMPLETE)throw Object(Ze.b)("Unknown operation type: "+n.type);o=this.Ne(e,n.path,r,a)}var l=a.getChanges();return t.Ie(e,o,l),new tn(o,l)},t.Ie=function(t,e,n){var r=e.getEventCache();if(r.isFullyInitialized()){var i=r.getNode().isLeafNode()||r.getNode().isEmpty(),o=t.getCompleteEventSnap();(n.length>0||!t.getEventCache().isFullyInitialized()||i&&!r.getNode().equals(o)||!r.getNode().getPriority().equals(o.getPriority()))&&n.push(Be.valueChange(e.getCompleteEventSnap()))}},t.prototype.Pe=function(t,e,n,r,i){var o=t.getEventCache();if(null!=n.shadowingWrite(e))return t;var s=void 0,a=void 0;if(e.isEmpty())if(Object(Ze.a)(t.getServerCache().isFullyInitialized(),"If change path is empty, we must have complete server data"),t.getServerCache().isFiltered()){var u=t.getCompleteServerSnap(),c=u instanceof Vt?u:Vt.EMPTY_NODE,h=n.calcCompleteEventChildren(c);s=this.be.updateFullNode(t.getEventCache().getNode(),h,i)}else{var l=n.calcCompleteEventCache(t.getCompleteServerSnap());s=this.be.updateFullNode(t.getEventCache().getNode(),l,i)}else{var p=e.getFront();if(".priority"==p){Object(Ze.a)(1==e.getLength(),"Can't have a priority with additional path components");var d=o.getNode();a=t.getServerCache().getNode();var f=n.calcEventCacheAfterServerOverwrite(e,d,a);s=null!=f?this.be.updatePriority(d,f):o.getNode()}else{var _=e.popFront(),y=void 0;if(o.isCompleteForChild(p)){a=t.getServerCache().getNode();var v=n.calcEventCacheAfterServerOverwrite(e,o.getNode(),a);y=null!=v?o.getNode().getImmediateChild(p).updateChild(_,v):o.getNode().getImmediateChild(p)}else y=n.calcCompleteChild(p,t.getServerCache());s=null!=y?this.be.updateChild(o.getNode(),p,y,_,r,i):o.getNode()}}return t.updateEventSnap(s,o.isFullyInitialized()||e.isEmpty(),this.be.filtersNodes())},t.prototype.Ee=function(t,e,n,r,i,o,s){var a,u=t.getServerCache(),c=o?this.be:this.be.getIndexedFilter();if(e.isEmpty())a=c.updateFullNode(u.getNode(),n,null);else if(c.filtersNodes()&&!u.isFiltered()){var h=u.getNode().updateChild(e,n);a=c.updateFullNode(u.getNode(),h,null)}else{var l=e.getFront();if(!u.isCompleteForPath(e)&&e.getLength()>1)return t;var p=e.popFront(),d=u.getNode().getImmediateChild(l),f=d.updateChild(p,n);a=".priority"==l?c.updatePriority(u.getNode(),f):c.updateChild(u.getNode(),l,f,p,$e,null)}var _=t.updateServerSnap(a,u.isFullyInitialized()||e.isEmpty(),c.filtersNodes()),y=new Je(r,_,i);return this.Pe(_,e,r,y,s)},t.prototype.Ce=function(t,e,n,r,i,o){var s,a,u=t.getEventCache(),c=new Je(r,t,i);if(e.isEmpty())a=this.be.updateFullNode(t.getEventCache().getNode(),n,o),s=t.updateEventSnap(a,!0,this.be.filtersNodes());else{var h=e.getFront();if(".priority"===h)a=this.be.updatePriority(t.getEventCache().getNode(),n),s=t.updateEventSnap(a,u.isFullyInitialized(),u.isFiltered());else{var l=e.popFront(),p=u.getNode().getImmediateChild(h),d=void 0;if(l.isEmpty())d=n;else{var f=c.getCompleteChild(h);d=null!=f?".priority"===l.getBack()&&f.getChild(l.parent()).isEmpty()?f:f.updateChild(l,n):Vt.EMPTY_NODE}if(p.equals(d))s=t;else{var _=this.be.updateChild(u.getNode(),h,d,l,c,o);s=t.updateEventSnap(_,u.isFullyInitialized(),this.be.filtersNodes())}}}return s},t.Re=function(t,e){return t.getEventCache().isCompleteForChild(e)},t.prototype.we=function(e,n,r,i,o,s){var a=this,u=e;return r.foreach(function(r,c){var h=n.child(r);t.Re(e,h.getFront())&&(u=a.Ce(u,h,c,i,o,s))}),r.foreach(function(r,c){var h=n.child(r);t.Re(e,h.getFront())||(u=a.Ce(u,h,c,i,o,s))}),u},t.prototype.De=function(t,e){return e.foreach(function(e,n){t=t.updateChild(e,n)}),t},t.prototype.Oe=function(t,e,n,r,i,o,s){var a=this;if(t.getServerCache().getNode().isEmpty()&&!t.getServerCache().isFullyInitialized())return t;var u,c=t;u=e.isEmpty()?n:Le.Empty.setTree(e,n);var h=t.getServerCache().getNode();return u.children.inorderTraversal(function(e,n){if(h.hasChild(e)){var u=t.getServerCache().getNode().getImmediateChild(e),l=a.De(u,n);c=a.Ee(c,new v(e),l,r,i,o,s)}}),u.children.inorderTraversal(function(e,n){var u=!t.getServerCache().isCompleteForChild(e)&&null==n.value;if(!h.hasChild(e)&&!u){var l=t.getServerCache().getNode().getImmediateChild(e),p=a.De(l,n);c=a.Ee(c,new v(e),p,r,i,o,s)}}),c},t.prototype.Te=function(t,e,n,r,i,o){if(null!=r.shadowingWrite(e))return t;var s=t.getServerCache().isFiltered(),a=t.getServerCache();if(null!=n.value){if(e.isEmpty()&&a.isFullyInitialized()||a.isCompleteForPath(e))return this.Ee(t,e,a.getNode().getChild(e),r,i,s,o);if(e.isEmpty()){var u=Le.Empty;return a.getNode().forEachChild(dt,function(t,e){u=u.set(new v(t),e)}),this.Oe(t,e,u,r,i,s,o)}return t}var c=Le.Empty;return n.foreach(function(t,n){var r=e.child(t);a.isCompleteForPath(r)&&(c=c.set(t,a.getNode().getChild(r)))}),this.Oe(t,e,c,r,i,s,o)},t.prototype.Ne=function(t,e,n,r){var i=t.getServerCache(),o=t.updateServerSnap(i.getNode(),i.isFullyInitialized()||e.isEmpty(),i.isFiltered());return this.Pe(o,e,n,$e,r)},t.prototype.Se=function(t,e,n,r,i){var o;if(null!=n.shadowingWrite(e))return t;var s=new Je(n,t,r),a=t.getEventCache().getNode(),u=void 0;if(e.isEmpty()||".priority"===e.getFront()){var c=void 0;if(t.getServerCache().isFullyInitialized())c=n.calcCompleteEventCache(t.getCompleteServerSnap());else{var h=t.getServerCache().getNode();Object(Ze.a)(h instanceof Vt,"serverChildren would be complete if leaf node"),c=n.calcCompleteEventChildren(h)}c=c,u=this.be.updateFullNode(a,c,i)}else{var l=e.getFront(),p=n.calcCompleteChild(l,t.getServerCache());null==p&&t.getServerCache().isCompleteForChild(l)&&(p=a.getImmediateChild(l)),u=null!=p?this.be.updateChild(a,l,p,e.popFront(),s,i):t.getEventCache().getNode().hasChild(l)?this.be.updateChild(a,l,Vt.EMPTY_NODE,e.popFront(),s,i):a,u.isEmpty()&&t.getServerCache().isFullyInitialized()&&(o=n.calcCompleteEventCache(t.getCompleteServerSnap()),o.isLeafNode()&&(u=this.be.updateFullNode(u,o,i)))}return o=t.getServerCache().isFullyInitialized()||null!=n.shadowingWrite(v.Empty),t.updateEventSnap(u,o,this.be.filtersNodes())},t}(),nn=n(0),rn=function(){function t(t){this.je=t,this.Xt=this.je.getQueryParams().getIndex()}return t.prototype.generateEventsForChanges=function(t,e,n){var r=this,i=[],o=[];return t.forEach(function(t){t.type===Be.CHILD_CHANGED&&r.Xt.indexedValueChanged(t.oldSnap,t.snapshotNode)&&o.push(Be.childMovedChange(t.childName,t.snapshotNode))}),this.xe(i,Be.CHILD_REMOVED,t,n,e),this.xe(i,Be.CHILD_ADDED,t,n,e),this.xe(i,Be.CHILD_MOVED,o,n,e),this.xe(i,Be.CHILD_CHANGED,t,n,e),this.xe(i,Be.VALUE,t,n,e),i},t.prototype.xe=function(t,e,n,r,i){var o=this,s=n.filter(function(t){return t.type===e});s.sort(this.ke.bind(this)),s.forEach(function(e){var n=o.Fe(e,i);r.forEach(function(r){r.respondsTo(e.type)&&t.push(r.createEvent(n,o.je))})})},t.prototype.Fe=function(t,e){return"value"===t.type||"child_removed"===t.type?t:(t.prevName=e.getPredecessorChildName(t.childName,t.snapshotNode,this.Xt),t)},t.prototype.ke=function(t,e){if(null==t.childName||null==e.childName)throw Object(nn.b)("Should only compare child_ events.");var n=new st(t.childName,t.snapshotNode),r=new st(e.childName,e.snapshotNode);return this.Xt.compare(n,r)},t}(),on=n(0),sn=function(){function t(t,e){this.je=t,this.Ae=[];var n=this.je.getQueryParams(),r=new Ke(n.getIndex()),i=n.getNodeFilter();this.Le=new en(i);var o=e.getServerCache(),s=e.getEventCache(),a=r.updateFullNode(Vt.EMPTY_NODE,o.getNode(),null),u=i.updateFullNode(Vt.EMPTY_NODE,s.getNode(),null),c=new Ue(a,o.isFullyInitialized(),r.filtersNodes()),h=new Ue(u,s.isFullyInitialized(),i.filtersNodes());this.ge=new Ve(h,c),this.Me=new rn(this.je)}return t.prototype.getQuery=function(){return this.je},t.prototype.getServerCache=function(){return this.ge.getServerCache().getNode()},t.prototype.getCompleteServerCache=function(t){var e=this.ge.getCompleteServerSnap();return e&&(this.je.getQueryParams().loadsAllData()||!t.isEmpty()&&!e.getImmediateChild(t.getFront()).isEmpty())?e.getChild(t):null},t.prototype.isEmpty=function(){return 0===this.Ae.length},t.prototype.addEventRegistration=function(t){this.Ae.push(t)},t.prototype.removeEventRegistration=function(t,e){var n=[];if(e){Object(on.a)(null==t,"A cancel should cancel all event registrations.");var r=this.je.path;this.Ae.forEach(function(t){e=e;var i=t.createCancelEvent(e,r);i&&n.push(i)})}if(t){for(var i=[],o=0;o<this.Ae.length;++o){var s=this.Ae[o];if(s.matches(t)){if(t.hasAnyCallback()){i=i.concat(this.Ae.slice(o+1));break}}else i.push(s)}this.Ae=i}else this.Ae=[];return n},t.prototype.applyOperation=function(t,e,n){t.type===$t.MERGE&&null!==t.source.queryId&&(Object(on.a)(this.ge.getCompleteServerSnap(),"We should always have a full cache before handling merges"),Object(on.a)(this.ge.getCompleteEventSnap(),"Missing event cache, even though we have a server cache"));var r=this.ge,i=this.Le.applyOperation(r,t,e,n);return this.Le.assertIndexed(i.viewCache),Object(on.a)(i.viewCache.getServerCache().isFullyInitialized()||!r.getServerCache().isFullyInitialized(),"Once a server snap is complete, it should never go back"),this.ge=i.viewCache,this.We(i.changes,i.viewCache.getEventCache().getNode(),null)},t.prototype.getInitialEvents=function(t){var e=this.ge.getEventCache(),n=[];return e.getNode().isLeafNode()||e.getNode().forEachChild(Nt,function(t,e){n.push(Be.childAddedChange(t,e))}),e.isFullyInitialized()&&n.push(Be.valueChange(e.getNode())),this.We(n,e.getNode(),t)},t.prototype.We=function(t,e,n){var r=n?[n]:this.Ae;return this.Me.generateEventsForChanges(t,e,r)},t}(),an=n(0),un=n(2),cn=function(){function t(){this.qe={}}return Object.defineProperty(t,"__referenceConstructor",{get:function(){return Object(an.a)(Re,"Reference.ts has not been loaded"),Re},set:function(t){Object(an.a)(!Re,"__referenceConstructor has already been defined"),Re=t},enumerable:!0,configurable:!0}),t.prototype.isEmpty=function(){return Object(un.j)(this.qe)},t.prototype.applyOperation=function(t,e,n){var r=t.source.queryId;if(null!==r){var i=Object(un.l)(this.qe,r);return Object(an.a)(null!=i,"SyncTree gave us an op for an invalid query."),i.applyOperation(t,e,n)}var o=[];return Object(un.f)(this.qe,function(r,i){o=o.concat(i.applyOperation(t,e,n))}),o},t.prototype.addEventRegistration=function(t,e,n,r,i){var o=t.queryIdentifier(),s=Object(un.l)(this.qe,o);if(!s){var a=n.calcCompleteEventCache(i?r:null),u=!1;a?u=!0:r instanceof Vt?(a=n.calcCompleteEventChildren(r),u=!1):(a=Vt.EMPTY_NODE,u=!1);var c=new Ve(new Ue(a,u,!1),new Ue(r,i,!1));s=new sn(t,c),this.qe[o]=s}return s.addEventRegistration(e),s.getInitialEvents(e)},t.prototype.removeEventRegistration=function(e,n,r){var i=e.queryIdentifier(),o=[],s=[],a=this.hasCompleteView();if("default"===i){var u=this;Object(un.f)(this.qe,function(t,e){s=s.concat(e.removeEventRegistration(n,r)),e.isEmpty()&&(delete u.qe[t],e.getQuery().getQueryParams().loadsAllData()||o.push(e.getQuery()))})}else{var c=Object(un.l)(this.qe,i);c&&(s=s.concat(c.removeEventRegistration(n,r)),c.isEmpty()&&(delete this.qe[i],c.getQuery().getQueryParams().loadsAllData()||o.push(c.getQuery())))}return a&&!this.hasCompleteView()&&o.push(new t.se(e.repo,e.path)),{removed:o,events:s}},t.prototype.getQueryViews=function(){var t=this;return Object.keys(this.qe).map(function(e){return t.qe[e]}).filter(function(t){return!t.getQuery().getQueryParams().loadsAllData()})},t.prototype.getCompleteServerCache=function(t){var e=null;return Object(un.f)(this.qe,function(n,r){e=e||r.getCompleteServerCache(t)}),e},t.prototype.viewForQuery=function(t){if(t.getQueryParams().loadsAllData())return this.getCompleteView();var e=t.queryIdentifier();return Object(un.l)(this.qe,e)},t.prototype.viewExistsForQuery=function(t){return null!=this.viewForQuery(t)},t.prototype.hasCompleteView=function(){return null!=this.getCompleteView()},t.prototype.getCompleteView=function(){return Object(un.e)(this.qe,function(t){return t.getQuery().getQueryParams().loadsAllData()})||null},t}(),hn=n(2),ln=n(0),pn=function(){function t(t){this.Qe=t}return t.prototype.addWrite=function(e,n){if(e.isEmpty())return new t(new Le(n));var r=this.Qe.findRootMostValueAndPath(e);if(null!=r){var i=r.path,o=r.value,s=v.relativePath(i,e);return o=o.updateChild(s,n),new t(this.Qe.set(i,o))}var a=new Le(n);return new t(this.Qe.setTree(e,a))},t.prototype.addWrites=function(t,e){var n=this;return Object(hn.f)(e,function(e,r){n=n.addWrite(t.child(e),r)}),n},t.prototype.removeWrite=function(e){return e.isEmpty()?t.Empty:new t(this.Qe.setTree(e,Le.Empty))},t.prototype.hasCompleteWrite=function(t){return null!=this.getCompleteNode(t)},t.prototype.getCompleteNode=function(t){var e=this.Qe.findRootMostValueAndPath(t);return null!=e?this.Qe.get(e.path).getChild(v.relativePath(e.path,t)):null},t.prototype.getCompleteChildren=function(){var t=[],e=this.Qe.value;return null!=e?e.isLeafNode()||e.forEachChild(Nt,function(e,n){t.push(new st(e,n))}):this.Qe.children.inorderTraversal(function(e,n){null!=n.value&&t.push(new st(e,n.value))}),t},t.prototype.childCompoundWrite=function(e){if(e.isEmpty())return this;var n=this.getCompleteNode(e);return new t(null!=n?new Le(n):this.Qe.subtree(e))},t.prototype.isEmpty=function(){return this.Qe.isEmpty()},t.prototype.apply=function(e){return t.Ue(v.Empty,this.Qe,e)},t.Empty=new t(new Le(null)),t.Ue=function(e,n,r){if(null!=n.value)return r.updateChild(e,n.value);var i=null;return n.children.inorderTraversal(function(n,o){".priority"===n?(Object(ln.a)(null!==o.value,"Priority writes must always be leaf nodes"),i=o.value):r=t.Ue(e.child(n),o,r)}),r.getChild(e).isEmpty()||null===i||(r=r.updateChild(e.child(".priority"),i)),r},t}(),dn=n(2),fn=n(0),_n=function(){function t(){this.Ve=pn.Empty,this.Be=[],this.He=-1}return t.prototype.childWrites=function(t){return new yn(t,this)},t.prototype.addOverwrite=function(t,e,n,r){Object(fn.a)(n>this.He,"Stacking an older write on top of newer ones"),void 0===r&&(r=!0),this.Be.push({path:t,snap:e,writeId:n,visible:r}),r&&(this.Ve=this.Ve.addWrite(t,e)),this.He=n},t.prototype.addMerge=function(t,e,n){Object(fn.a)(n>this.He,"Stacking an older merge on top of newer ones"),this.Be.push({path:t,children:e,writeId:n,visible:!0}),this.Ve=this.Ve.addWrites(t,e),this.He=n},t.prototype.getWrite=function(t){for(var e=0;e<this.Be.length;e++){var n=this.Be[e];if(n.writeId===t)return n}return null},t.prototype.removeWrite=function(t){var e=this,n=this.Be.findIndex(function(e){return e.writeId===t});Object(fn.a)(n>=0,"removeWrite called with nonexistent writeId.");var r=this.Be[n];this.Be.splice(n,1);for(var i=r.visible,o=!1,s=this.Be.length-1;i&&s>=0;){var a=this.Be[s];a.visible&&(s>=n&&this.Ke(a,r.path)?i=!1:r.path.contains(a.path)&&(o=!0)),s--}if(i){if(o)return this.Ye(),!0;if(r.snap)this.Ve=this.Ve.removeWrite(r.path);else{var u=r.children;Object(dn.f)(u,function(t){e.Ve=e.Ve.removeWrite(r.path.child(t))})}return!0}return!1},t.prototype.getCompleteWriteData=function(t){return this.Ve.getCompleteNode(t)},t.prototype.calcCompleteEventCache=function(e,n,r,i){if(r||i){var o=this.Ve.childCompoundWrite(e);if(!i&&o.isEmpty())return n;if(i||null!=n||o.hasCompleteWrite(v.Empty)){var s=function(t){return(t.visible||i)&&(!r||!~r.indexOf(t.writeId))&&(t.path.contains(e)||e.contains(t.path))},a=t.ze(this.Be,s,e),u=n||Vt.EMPTY_NODE;return a.apply(u)}return null}var c=this.Ve.getCompleteNode(e);if(null!=c)return c;var h=this.Ve.childCompoundWrite(e);if(h.isEmpty())return n;if(null!=n||h.hasCompleteWrite(v.Empty)){var u=n||Vt.EMPTY_NODE;return h.apply(u)}return null},t.prototype.calcCompleteEventChildren=function(t,e){var n=Vt.EMPTY_NODE,r=this.Ve.getCompleteNode(t);if(r)return r.isLeafNode()||r.forEachChild(Nt,function(t,e){n=n.updateImmediateChild(t,e)}),n;if(e){var i=this.Ve.childCompoundWrite(t);return e.forEachChild(Nt,function(t,e){var r=i.childCompoundWrite(new v(t)).apply(e);n=n.updateImmediateChild(t,r)}),i.getCompleteChildren().forEach(function(t){n=n.updateImmediateChild(t.name,t.node)}),n}return this.Ve.childCompoundWrite(t).getCompleteChildren().forEach(function(t){n=n.updateImmediateChild(t.name,t.node)}),n},t.prototype.calcEventCacheAfterServerOverwrite=function(t,e,n,r){Object(fn.a)(n||r,"Either existingEventSnap or existingServerSnap must exist");var i=t.child(e);if(this.Ve.hasCompleteWrite(i))return null;var o=this.Ve.childCompoundWrite(i);return o.isEmpty()?r.getChild(e):o.apply(r.getChild(e))},t.prototype.calcCompleteChild=function(t,e,n){var r=t.child(e),i=this.Ve.getCompleteNode(r);return null!=i?i:n.isCompleteForChild(e)?this.Ve.childCompoundWrite(r).apply(n.getNode().getImmediateChild(e)):null},t.prototype.shadowingWrite=function(t){return this.Ve.getCompleteNode(t)},t.prototype.calcIndexedSlice=function(t,e,n,r,i,o){var s,a=this.Ve.childCompoundWrite(t),u=a.getCompleteNode(v.Empty);if(null!=u)s=u;else{if(null==e)return[];s=a.apply(e)}if(s=s.withIndex(o),s.isEmpty()||s.isLeafNode())return[];for(var c=[],h=o.getCompare(),l=i?s.getReverseIteratorFrom(n,o):s.getIteratorFrom(n,o),p=l.getNext();p&&c.length<r;)0!==h(p,n)&&c.push(p),p=l.getNext();return c},t.prototype.Ke=function(t,e){return t.snap?t.path.contains(e):!!Object(dn.d)(t.children,function(n,r){return t.path.child(r).contains(e)})},t.prototype.Ye=function(){this.Ve=t.ze(this.Be,t.Ge,v.Empty),this.Be.length>0?this.He=this.Be[this.Be.length-1].writeId:this.He=-1},t.Ge=function(t){return t.visible},t.ze=function(t,e,n){for(var r=pn.Empty,i=0;i<t.length;++i){var o=t[i];if(e(o)){var s=o.path,a=void 0;if(o.snap)n.contains(s)?(a=v.relativePath(n,s),r=r.addWrite(a,o.snap)):s.contains(n)&&(a=v.relativePath(s,n),r=r.addWrite(v.Empty,o.snap.getChild(a)));else{if(!o.children)throw Object(fn.b)("WriteRecord should have .snap or .children");if(n.contains(s))a=v.relativePath(n,s),r=r.addWrites(a,o.children);else if(s.contains(n))if(a=v.relativePath(s,n),a.isEmpty())r=r.addWrites(v.Empty,o.children);else{var u=Object(dn.l)(o.children,a.getFront());if(u){var c=u.getChild(a.popFront());r=r.addWrite(v.Empty,c)}}}}}return r},t}(),yn=function(){function t(t,e){this.Xe=t,this.Qe=e}return t.prototype.calcCompleteEventCache=function(t,e,n){return this.Qe.calcCompleteEventCache(this.Xe,t,e,n)},t.prototype.calcCompleteEventChildren=function(t){return this.Qe.calcCompleteEventChildren(this.Xe,t)},t.prototype.calcEventCacheAfterServerOverwrite=function(t,e,n){return this.Qe.calcEventCacheAfterServerOverwrite(this.Xe,t,e,n)},t.prototype.shadowingWrite=function(t){return this.Qe.shadowingWrite(this.Xe.child(t))},t.prototype.calcIndexedSlice=function(t,e,n,r,i){return this.Qe.calcIndexedSlice(this.Xe,t,e,n,r,i)},t.prototype.calcCompleteChild=function(t,e){return this.Qe.calcCompleteChild(this.Xe,t,e)},t.prototype.child=function(e){return new t(this.Xe.child(e),this.Qe)},t}(),vn=n(0),gn=n(1),mn=n(2),bn=function(){function t(t){this.$e=t,this.Je=Le.Empty,this.Ze=new _n,this.tn={},this.en={}}return t.prototype.applyUserOverwrite=function(t,e,n,r){return this.Ze.addOverwrite(t,e,n,r),r?this.nn(new We(De.User,t,e)):[]},t.prototype.applyUserMerge=function(t,e,n){this.Ze.addMerge(t,e,n);var r=Le.fromObject(e);return this.nn(new Qe(De.User,t,r))},t.prototype.ackUserWrite=function(t,e){void 0===e&&(e=!1);var n=this.Ze.getWrite(t);if(this.Ze.removeWrite(t)){var r=Le.Empty;return null!=n.snap?r=r.set(v.Empty,!0):Object(mn.f)(n.children,function(t,e){r=r.set(new v(t),e)}),this.nn(new xe(n.path,r,e))}return[]},t.prototype.applyServerOverwrite=function(t,e){return this.nn(new We(De.Server,t,e))},t.prototype.applyServerMerge=function(t,e){var n=Le.fromObject(e);return this.nn(new Qe(De.Server,t,n))},t.prototype.applyListenComplete=function(t){return this.nn(new Me(De.Server,t))},t.prototype.applyTaggedQueryOverwrite=function(e,n,r){var i=this.rn(r);if(null!=i){var o=t.in(i),s=o.path,a=o.queryId,u=v.relativePath(s,e),c=new We(De.forServerTaggedQuery(a),u,n);return this.sn(s,c)}return[]},t.prototype.applyTaggedQueryMerge=function(e,n,r){var i=this.rn(r);if(i){var o=t.in(i),s=o.path,a=o.queryId,u=v.relativePath(s,e),c=Le.fromObject(n),h=new Qe(De.forServerTaggedQuery(a),u,c);return this.sn(s,h)}return[]},t.prototype.applyTaggedListenComplete=function(e,n){var r=this.rn(n);if(r){var i=t.in(r),o=i.path,s=i.queryId,a=v.relativePath(o,e),u=new Me(De.forServerTaggedQuery(s),a);return this.sn(o,u)}return[]},t.prototype.addEventRegistration=function(e,n){var r=e.path,i=null,o=!1;this.Je.foreachOnPath(r,function(t,e){var n=v.relativePath(t,r);i=i||e.getCompleteServerCache(n),o=o||e.hasCompleteView()});var s=this.Je.get(r);s?(o=o||s.hasCompleteView(),i=i||s.getCompleteServerCache(v.Empty)):(s=new cn,this.Je=this.Je.set(r,s));var a;null!=i?a=!0:(a=!1,i=Vt.EMPTY_NODE,this.Je.subtree(r).foreachChild(function(t,e){var n=e.getCompleteServerCache(v.Empty);n&&(i=i.updateImmediateChild(t,n))}));var u=s.viewExistsForQuery(e);if(!u&&!e.getQueryParams().loadsAllData()){var c=t.an(e);Object(vn.a)(!(c in this.en),"View does not exist, but we have a tag");var h=t.un();this.en[c]=h,this.tn["_"+h]=c}var l=this.Ze.childWrites(r),p=s.addEventRegistration(e,n,l,i,a);if(!u&&!o){var d=s.viewForQuery(e);p=p.concat(this.cn(e,d))}return p},t.prototype.removeEventRegistration=function(e,n,r){var i=this,o=e.path,s=this.Je.get(o),a=[];if(s&&("default"===e.queryIdentifier()||s.viewExistsForQuery(e))){var u=s.removeEventRegistration(e,n,r);s.isEmpty()&&(this.Je=this.Je.remove(o));var c=u.removed;a=u.events;var h=-1!==c.findIndex(function(t){return t.getQueryParams().loadsAllData()}),l=this.Je.findOnPath(o,function(t,e){return e.hasCompleteView()});if(h&&!l){var p=this.Je.subtree(o);if(!p.isEmpty())for(var d=this.hn(p),f=0;f<d.length;++f){var _=d[f],y=_.getQuery(),v=this.ln(_);this.$e.startListening(t.pn(y),this.dn(y),v.hashFn,v.onComplete)}}!l&&c.length>0&&!r&&(h?this.$e.stopListening(t.pn(e),null):c.forEach(function(e){var n=i.en[t.an(e)];i.$e.stopListening(t.pn(e),n)})),this.fn(c)}return a},t.prototype.calcCompleteEventCache=function(t,e){var n=this.Ze,r=this.Je.findOnPath(t,function(e,n){var r=v.relativePath(e,t),i=n.getCompleteServerCache(r);if(i)return i});return n.calcCompleteEventCache(t,r,e,!0)},t.prototype.hn=function(t){return t.fold(function(t,e,n){if(e&&e.hasCompleteView())return[e.getCompleteView()];var r=[];return e&&(r=e.getQueryViews()),Object(mn.f)(n,function(t,e){r=r.concat(e)}),r})},t.prototype.fn=function(e){for(var n=0;n<e.length;++n){var r=e[n];if(!r.getQueryParams().loadsAllData()){var i=t.an(r),o=this.en[i];delete this.en[i],delete this.tn["_"+o]}}},t.pn=function(t){return t.getQueryParams().loadsAllData()&&!t.getQueryParams().isDefault()?t.getRef():t},t.prototype.cn=function(e,n){var r=e.path,i=this.dn(e),o=this.ln(n),s=this.$e.startListening(t.pn(e),i,o.hashFn,o.onComplete),a=this.Je.subtree(r);if(i)Object(vn.a)(!a.value.hasCompleteView(),"If we're adding a query, it shouldn't be shadowed");else for(var u=a.fold(function(t,e,n){if(!t.isEmpty()&&e&&e.hasCompleteView())return[e.getCompleteView().getQuery()];var r=[];return e&&(r=r.concat(e.getQueryViews().map(function(t){return t.getQuery()}))),Object(mn.f)(n,function(t,e){r=r.concat(e)}),r}),c=0;c<u.length;++c){var h=u[c];this.$e.stopListening(t.pn(h),this.dn(h))}return s},t.prototype.ln=function(t){var e=this,n=t.getQuery(),r=this.dn(n);return{hashFn:function(){return(t.getServerCache()||Vt.EMPTY_NODE).hash()},onComplete:function(t){if("ok"===t)return r?e.applyTaggedListenComplete(n.path,r):e.applyListenComplete(n.path);var i=Object(gn.l)(t,n);return e.removeEventRegistration(n,null,i)}}},t.an=function(t){return t.path+"$"+t.queryIdentifier()},t.in=function(t){var e=t.indexOf("$");return Object(vn.a)(-1!==e&&e<t.length-1,"Bad queryKey."),{queryId:t.substr(e+1),path:new v(t.substr(0,e))}},t.prototype.rn=function(t){return this.tn["_"+t]},t.prototype.dn=function(e){var n=t.an(e);return Object(mn.l)(this.en,n)},t.un=function(){return t._n++},t.prototype.sn=function(t,e){var n=this.Je.get(t);Object(vn.a)(n,"Missing sync point for query tag that we're tracking");var r=this.Ze.childWrites(t);return n.applyOperation(e,r,null)},t.prototype.nn=function(t){return this.yn(t,this.Je,null,this.Ze.childWrites(v.Empty))},t.prototype.yn=function(t,e,n,r){if(t.path.isEmpty())return this.vn(t,e,n,r);var i=e.get(v.Empty);null==n&&null!=i&&(n=i.getCompleteServerCache(v.Empty));var o=[],s=t.path.getFront(),a=t.operationForChild(s),u=e.children.get(s);if(u&&a){var c=n?n.getImmediateChild(s):null,h=r.child(s);o=o.concat(this.yn(a,u,c,h))}return i&&(o=o.concat(i.applyOperation(t,r,n))),o},t.prototype.vn=function(t,e,n,r){var i=this,o=e.get(v.Empty);null==n&&null!=o&&(n=o.getCompleteServerCache(v.Empty));var s=[];return e.children.inorderTraversal(function(e,o){var a=n?n.getImmediateChild(e):null,u=r.child(e),c=t.operationForChild(e);c&&(s=s.concat(i.vn(c,o,a,u)))}),o&&(s=s.concat(o.applyOperation(t,r,n))),s},t._n=1,t}(),Cn=function(){function t(){this.gn=Vt.EMPTY_NODE}return t.prototype.getNode=function(t){return this.gn.getChild(t)},t.prototype.updateSnapshot=function(t,e){this.gn=this.gn.updateChild(t,e)},t}(),En=n(1),wn=function(){function t(t){this.mn=t}return t.prototype.getToken=function(t){return this.mn.INTERNAL.getToken(t).then(null,function(t){return t&&"auth/token-not-initialized"===t.code?(Object(En.s)("Got auth/token-not-initialized error.  Treating as null token."),null):Promise.reject(t)})},t.prototype.addTokenChangeListener=function(t){this.mn.INTERNAL.addAuthTokenListener(t)},t.prototype.removeTokenChangeListener=function(t){this.mn.INTERNAL.removeAuthTokenListener(t)},t.prototype.notifyForInvalidToken=function(){var t='Provided authentication credentials for the app named "'+this.mn.name+'" are invalid. This usually indicates your app was not initialized correctly. ';"credential"in this.mn.options?t+='Make sure the "credential" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':"serviceAccount"in this.mn.options?t+='Make sure the "serviceAccount" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':t+='Make sure the "apiKey" and "databaseURL" properties provided to initializeApp() match the values provided for your app at https://console.firebase.google.com/.',Object(En.B)(t)},t}(),On=n(2),Sn=function(){function t(t){this.bn=t,this.Cn=null}return t.prototype.get=function(){var t=this.bn.get(),e=Object(On.a)(t);return this.Cn&&Object(On.f)(this.Cn,function(t,n){e[t]=e[t]-n}),this.Cn=t,e},t}(),Tn=n(2),Nn=n(1),In=1e4,Pn=3e4,Rn=function(){function t(t,e){this.En=e,this.wn={},this.On=new Sn(t);var n=In+(Pn-In)*Math.random();Object(Nn.x)(this.Sn.bind(this),Math.floor(n))}return t.prototype.includeStat=function(t){this.wn[t]=!0},t.prototype.Sn=function(){var t=this,e=this.On.get(),n={},r=!1;Object(Tn.f)(e,function(e,i){i>0&&Object(Tn.b)(t.wn,e)&&(n[e]=i,r=!0)}),r&&this.En.reportStats(n),Object(Nn.x)(this.Sn.bind(this),Math.floor(2*Math.random()*3e5))},t}(),Dn=n(1),jn=function(){function t(){this.Tn=[],this.Nn=0}return t.prototype.queueEvents=function(t){for(var e=null,n=0;n<t.length;n++){var r=t[n],i=r.getPath();null===e||i.equals(e.getPath())||(this.Tn.push(e),e=null),null===e&&(e=new xn(i)),e.add(r)}e&&this.Tn.push(e)},t.prototype.raiseEventsAtPath=function(t,e){this.queueEvents(e),this.In(function(e){return e.equals(t)})},t.prototype.raiseEventsForChangedPath=function(t,e){this.queueEvents(e),this.In(function(e){return e.contains(t)||t.contains(e)})},t.prototype.In=function(t){this.Nn++;for(var e=!0,n=0;n<this.Tn.length;n++){var r=this.Tn[n];r&&(t(r.getPath())?(this.Tn[n].raise(),this.Tn[n]=null):e=!1)}e&&(this.Tn=[]),this.Nn--},t}(),xn=function(){function t(t){this.yt=t,this.Pn=[]}return t.prototype.add=function(t){this.Pn.push(t)},t.prototype.raise=function(){for(var t=0;t<this.Pn.length;t++){var e=this.Pn[t];if(null!==e){this.Pn[t]=null;var n=e.getEventRunner();Dn.u&&Object(Dn.s)("event: "+e),Object(Dn.m)(n)}}},t.prototype.getPath=function(){return this.yt},t}(),kn=n(0),Fn=function(){function t(t){this.Rn=t,this.Dn={},Object(kn.a)(Array.isArray(t)&&t.length>0,"Requires a non-empty array")}return t.prototype.trigger=function(t){for(var e=[],n=1;n<arguments.length;n++)e[n-1]=arguments[n];if(Array.isArray(this.Dn[t]))for(var r=this.Dn[t].slice(),i=0;i<r.length;i++)r[i].callback.apply(r[i].context,e)},t.prototype.on=function(t,e,n){this.jn(t),this.Dn[t]=this.Dn[t]||[],this.Dn[t].push({callback:e,context:n});var r=this.getInitialEvent(t);r&&e.apply(n,r)},t.prototype.off=function(t,e,n){this.jn(t);for(var r=this.Dn[t]||[],i=0;i<r.length;i++)if(r[i].callback===e&&(!n||n===r[i].context))return void r.splice(i,1)},t.prototype.jn=function(t){Object(kn.a)(this.Rn.find(function(e){return e===t}),"Unknown event: "+t)},t}(),An=n(0),Ln=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),Mn=function(t){function e(){var e,n,r=t.call(this,["visible"])||this;return"undefined"!=typeof document&&void 0!==document.addEventListener&&(void 0!==document.hidden?(n="visibilitychange",e="hidden"):void 0!==document.mozHidden?(n="mozvisibilitychange",e="mozHidden"):void 0!==document.msHidden?(n="msvisibilitychange",e="msHidden"):void 0!==document.webkitHidden&&(n="webkitvisibilitychange",e="webkitHidden")),r.xn=!0,n&&document.addEventListener(n,function(){var t=!document[e];t!==r.xn&&(r.xn=t,r.trigger("visible",t))},!1),r}return Ln(e,t),e.getInstance=function(){return new e},e.prototype.getInitialEvent=function(t){return Object(An.a)("visible"===t,"Unknown event type: "+t),[this.xn]},e}(Fn),Wn=n(0),qn=n(6),Qn=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),Un=function(t){function e(){var e=t.call(this,["online"])||this;return e.kn=!0,"undefined"==typeof window||void 0===window.addEventListener||Object(qn.a)()||(window.addEventListener("online",function(){e.kn||(e.kn=!0,e.trigger("online",!0))},!1),window.addEventListener("offline",function(){e.kn&&(e.kn=!1,e.trigger("online",!1))},!1)),e}return Qn(e,t),e.getInstance=function(){return new e},e.prototype.getInitialEvent=function(t){return Object(Wn.a)("online"===t,"Unknown event type: "+t),[this.kn]},e.prototype.currentlyOnline=function(){return this.kn},e}(Fn),Vn=n(1),Bn=n(3),Hn="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Kn=function(t){var e={},n={},r={},i="";try{var o=t.split(".");e=Object(Bn.a)(Object(Vn.e)(o[0])||""),n=Object(Bn.a)(Object(Vn.e)(o[1])||""),i=o[2],r=n.d||{},delete n.d}catch(t){}return{header:e,claims:n,data:r,signature:i}},Yn=function(t){var e=Kn(t),n=e.claims;return!!e.signature&&!!n&&"object"===(void 0===n?"undefined":Hn(n))&&n.hasOwnProperty("iat")},zn=function(t){var e=Kn(t).claims;return"object"===(void 0===e?"undefined":Hn(e))&&!0===e.admin},Gn=n(1),Xn=function(){function t(t){this.Fn=t,this.pendingResponses=[],this.currentResponseNum=0,this.closeAfterResponse=-1,this.onClose=null}return t.prototype.closeAfter=function(t,e){this.closeAfterResponse=t,this.onClose=e,this.closeAfterResponse<this.currentResponseNum&&(this.onClose(),this.onClose=null)},t.prototype.handleResponse=function(t,e){var n=this;this.pendingResponses[t]=e;for(var r=this;this.pendingResponses[this.currentResponseNum]&&"break"!==function(){var t=r.pendingResponses[r.currentResponseNum];delete r.pendingResponses[r.currentResponseNum];for(var e=0;e<t.length;++e)!function(e){t[e]&&Object(Gn.m)(function(){n.Fn(t[e])})}(e);if(r.currentResponseNum===r.closeAfterResponse)return r.onClose&&(r.onClose(),r.onClose=null),"break";r.currentResponseNum++}(););},t}(),$n=n(1),Jn=n(12),Zn=n(9),tr=n(3),er=n(6),nr="pLPCommand",rr="pRTLPCB",ir=function(){function t(t,e,n,r){this.connId=t,this.repoInfo=e,this.transportSessionId=n,this.lastSessionId=r,this.bytesSent=0,this.bytesReceived=0,this.Z=!1,this.X=Object($n.t)(t),this.$=Jn.a.getCollection(e),this.urlFn=function(t){return e.connectionURL(Zn.d,t)}}return t.prototype.open=function(t,e){var n=this;this.curSegmentNum=0,this.An=e,this.myPacketOrderer=new Xn(t),this.ut=!1,this.Ln=setTimeout(function(){n.X("Timed out trying to connect."),n.tt(),n.Ln=null},Math.floor(3e4)),Object($n.n)(function(){if(!n.ut){n.scriptTagHolder=new or(function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var r=t[0],i=t[1],o=t[2];if(t[3],t[4],n.Mn(t),n.scriptTagHolder)if(n.Ln&&(clearTimeout(n.Ln),n.Ln=null),n.Z=!0,"start"==r)n.id=i,n.password=o;else{if("close"!==r)throw Error("Unrecognized command received: "+r);i?(n.scriptTagHolder.sendNewPolls=!1,n.myPacketOrderer.closeAfter(i,function(){n.tt()})):n.tt()}},function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var r=t[0],i=t[1];n.Mn(t),n.myPacketOrderer.handleResponse(r,i)},function(){n.tt()},n.urlFn);var t={};t.start="t",t.ser=Math.floor(1e8*Math.random()),n.scriptTagHolder.uniqueCallbackIdentifier&&(t.cb=n.scriptTagHolder.uniqueCallbackIdentifier),t[Zn.h]=Zn.e,n.transportSessionId&&(t[Zn.g]=n.transportSessionId),n.lastSessionId&&(t[Zn.c]=n.lastSessionId),!Object(er.b)()&&"undefined"!=typeof location&&location.href&&-1!==location.href.indexOf(Zn.a)&&(t[Zn.f]=Zn.b);var e=n.urlFn(t);n.X("Connecting via long-poll to "+e),n.scriptTagHolder.addTag(e,function(){})}})},t.prototype.start=function(){this.scriptTagHolder.startLongPoll(this.id,this.password),this.addDisconnectPingFrame(this.id,this.password)},t.forceAllow=function(){t.Wn=!0},t.forceDisallow=function(){t.et=!0},t.isAvailable=function(){return t.Wn||!t.et&&"undefined"!=typeof document&&null!=document.createElement&&!Object($n.p)()&&!Object($n.r)()&&!Object(er.b)()},t.prototype.markConnectionHealthy=function(){},t.prototype.st=function(){this.ut=!0,this.scriptTagHolder&&(this.scriptTagHolder.close(),this.scriptTagHolder=null),this.myDisconnFrame&&(document.body.removeChild(this.myDisconnFrame),this.myDisconnFrame=null),this.Ln&&(clearTimeout(this.Ln),this.Ln=null)},t.prototype.tt=function(){this.ut||(this.X("Longpoll is closing itself"),this.st(),this.An&&(this.An(this.Z),this.An=null))},t.prototype.close=function(){this.ut||(this.X("Longpoll is being closed."),this.st())},t.prototype.send=function(t){var e=Object(tr.b)(t);this.bytesSent+=e.length,this.$.incrementCounter("bytes_sent",e.length);for(var n=Object($n.f)(e),r=Object($n.z)(n,1840),i=0;i<r.length;i++)this.scriptTagHolder.enqueueSegment(this.curSegmentNum,r.length,r[i]),this.curSegmentNum++},t.prototype.addDisconnectPingFrame=function(t,e){if(!Object(er.b)()){this.myDisconnFrame=document.createElement("iframe");var n={};n.dframe="t",n.id=t,n.pw=e,this.myDisconnFrame.src=this.urlFn(n),this.myDisconnFrame.style.display="none",document.body.appendChild(this.myDisconnFrame)}},t.prototype.Mn=function(t){var e=Object(tr.b)(t).length;this.bytesReceived+=e,this.$.incrementCounter("bytes_received",e)},t}(),or=function(){function t(e,n,r,i){if(this.onDisconnect=r,this.urlFn=i,this.outstandingRequests=new be,this.pendingSegs=[],this.currentSerial=Math.floor(1e8*Math.random()),this.sendNewPolls=!0,Object(er.b)())this.commandCB=e,this.onMessageCB=n;else{this.uniqueCallbackIdentifier=Object($n.a)(),window[nr+this.uniqueCallbackIdentifier]=e,window[rr+this.uniqueCallbackIdentifier]=n,this.myIFrame=t.qn();var o="";this.myIFrame.src&&"javascript:"===this.myIFrame.src.substr(0,11)&&(o='<script>document.domain="'+document.domain+'";<\/script>');var s="<html><body>"+o+"</body></html>";try{this.myIFrame.doc.open(),this.myIFrame.doc.write(s),this.myIFrame.doc.close()}catch(t){Object($n.s)("frame writing exception"),t.stack&&Object($n.s)(t.stack),Object($n.s)(t)}}}return t.qn=function(){var t=document.createElement("iframe");if(t.style.display="none",!document.body)throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";document.body.appendChild(t);try{t.contentWindow.document||Object($n.s)("No IE domain setting required")}catch(n){var e=document.domain;t.src="javascript:void((function(){document.open();document.domain='"+e+"';document.close();})())"}return t.contentDocument?t.doc=t.contentDocument:t.contentWindow?t.doc=t.contentWindow.document:t.document&&(t.doc=t.document),t},t.prototype.close=function(){var e=this;if(this.alive=!1,this.myIFrame&&(this.myIFrame.doc.body.innerHTML="",setTimeout(function(){null!==e.myIFrame&&(document.body.removeChild(e.myIFrame),e.myIFrame=null)},Math.floor(0))),Object(er.b)()&&this.myID){var n={};n.disconn="t",n.id=this.myID,n.pw=this.myPW;var r=this.urlFn(n);t.nodeRestRequest(r)}var i=this.onDisconnect;i&&(this.onDisconnect=null,i())},t.prototype.startLongPoll=function(t,e){for(this.myID=t,this.myPW=e,this.alive=!0;this.Qn(););},t.prototype.Qn=function(){if(this.alive&&this.sendNewPolls&&this.outstandingRequests.count()<(this.pendingSegs.length>0?2:1)){this.currentSerial++;var t={};t.id=this.myID,t.pw=this.myPW,t.ser=this.currentSerial;for(var e=this.urlFn(t),n="",r=0;this.pendingSegs.length>0&&this.pendingSegs[0].d.length+30+n.length<=1870;){var i=this.pendingSegs.shift();n=n+"&seg"+r+"="+i.seg+"&ts"+r+"="+i.ts+"&d"+r+"="+i.d,r++}return e+=n,this.Un(e,this.currentSerial),!0}return!1},t.prototype.enqueueSegment=function(t,e,n){this.pendingSegs.push({seg:t,ts:e,d:n}),this.alive&&this.Qn()},t.prototype.Un=function(t,e){var n=this;this.outstandingRequests.add(e,1);var r=function(){n.outstandingRequests.remove(e),n.Qn()},i=setTimeout(r,Math.floor(25e3)),o=function(){clearTimeout(i),r()};this.addTag(t,o)},t.prototype.addTag=function(t,e){var n=this;Object(er.b)()?this.doNodeLongPoll(t,e):setTimeout(function(){try{if(!n.sendNewPolls)return;var r=n.myIFrame.doc.createElement("script");r.type="text/javascript",r.async=!0,r.src=t,r.onload=r.onreadystatechange=function(){var t=r.readyState;t&&"loaded"!==t&&"complete"!==t||(r.onload=r.onreadystatechange=null,r.parentNode&&r.parentNode.removeChild(r),e())},r.onerror=function(){Object($n.s)("Long-poll script failed to load: "+t),n.sendNewPolls=!1,n.close()},n.myIFrame.doc.body.appendChild(r)}catch(t){}},Math.floor(1))},t}(),sr=n(18),ar=n(1),ur=function(){function t(t){this.Vn(t)}return Object.defineProperty(t,"ALL_TRANSPORTS",{get:function(){return[ir,sr.a]},enumerable:!0,configurable:!0}),t.prototype.Vn=function(e){var n=sr.a&&sr.a.isAvailable(),r=n&&!sr.a.previouslyFailed();if(e.webSocketOnly&&(n||Object(ar.B)("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),r=!0),r)this.Bn=[sr.a];else{var i=this.Bn=[];Object(ar.i)(t.ALL_TRANSPORTS,function(t,e){e&&e.isAvailable()&&i.push(e)})}},t.prototype.initialTransport=function(){if(this.Bn.length>0)return this.Bn[0];throw Error("No transports available")},t.prototype.upgradeTransport=function(){return this.Bn.length>1?this.Bn[1]:null},t}(),cr=n(1),hr=n(8),lr=n(9),pr=function(){function t(t,e,n,r,i,o,s){this.id=t,this.Hn=e,this.Fn=n,this.Kn=r,this.An=i,this.Yn=o,this.lastSessionId=s,this.connectionCount=0,this.pendingDataMessages=[],this.zn=0,this.X=Object(cr.t)("c:"+this.id+":"),this.Gn=new ur(e),this.X("Connection created"),this.Xn()}return t.prototype.Xn=function(){var t=this,e=this.Gn.initialTransport();this.$n=new e(this.Jn(),this.Hn,void 0,this.lastSessionId),this.Zn=e.responsesRequiredToBeHealthy||0;var n=this.tr(this.$n),r=this.er(this.$n);this.nr=this.$n,this.rr=this.$n,this.ir=null,this.or=!1,setTimeout(function(){t.$n&&t.$n.open(n,r)},Math.floor(0));var i=e.healthyTimeout||0;i>0&&(this.sr=Object(cr.x)(function(){t.sr=null,t.or||(t.$n&&t.$n.bytesReceived>102400?(t.X("Connection exceeded healthy timeout but has received "+t.$n.bytesReceived+" bytes.  Marking connection healthy."),t.or=!0,t.$n.markConnectionHealthy()):t.$n&&t.$n.bytesSent>10240?t.X("Connection exceeded healthy timeout but has sent "+t.$n.bytesSent+" bytes.  Leaving connection alive."):(t.X("Closing unhealthy connection after timeout."),t.close()))},Math.floor(i)))},t.prototype.Jn=function(){return"c:"+this.id+":"+this.connectionCount++},t.prototype.er=function(t){var e=this;return function(n){t===e.$n?e.ar(n):t===e.ir?(e.X("Secondary connection lost."),e.ur()):e.X("closing an old connection")}},t.prototype.tr=function(t){var e=this;return function(n){2!=e.zn&&(t===e.rr?e.cr(n):t===e.ir?e.hr(n):e.X("message on old connection"))}},t.prototype.sendRequest=function(t){var e={t:"d",d:t};this.lr(e)},t.prototype.tryCleanupConnection=function(){this.nr===this.ir&&this.rr===this.ir&&(this.X("cleaning up and promoting a connection: "+this.ir.connId),this.$n=this.ir,this.ir=null)},t.prototype.pr=function(t){if("t"in t){var e=t.t;"a"===e?this.dr():"r"===e?(this.X("Got a reset on secondary, closing it"),this.ir.close(),this.nr!==this.ir&&this.rr!==this.ir||this.close()):"o"===e&&(this.X("got pong on secondary."),this.fr--,this.dr())}},t.prototype.hr=function(t){var e=Object(cr.w)("t",t),n=Object(cr.w)("d",t);if("c"==e)this.pr(n);else{if("d"!=e)throw Error("Unknown protocol layer: "+e);this.pendingDataMessages.push(n)}},t.prototype.dr=function(){this.fr<=0?(this.X("Secondary connection is healthy."),this.or=!0,this.ir.markConnectionHealthy(),this._r()):(this.X("sending ping on secondary."),this.ir.send({t:"c",d:{t:"p",d:{}}}))},t.prototype._r=function(){this.ir.start(),this.X("sending client ack on secondary"),this.ir.send({t:"c",d:{t:"a",d:{}}}),this.X("Ending transmission on primary"),this.$n.send({t:"c",d:{t:"n",d:{}}}),this.nr=this.ir,this.tryCleanupConnection()},t.prototype.cr=function(t){var e=Object(cr.w)("t",t),n=Object(cr.w)("d",t);"c"==e?this.yr(n):"d"==e&&this.vr(n)},t.prototype.vr=function(t){this.gr(),this.Fn(t)},t.prototype.gr=function(){this.or||--this.Zn<=0&&(this.X("Primary connection is healthy."),this.or=!0,this.$n.markConnectionHealthy())},t.prototype.yr=function(t){var e=Object(cr.w)("t",t);if("d"in t){var n=t.d;if("h"===e)this.mr(n);else if("n"===e){this.X("recvd end transmission on primary"),this.rr=this.ir;for(var r=0;r<this.pendingDataMessages.length;++r)this.vr(this.pendingDataMessages[r]);this.pendingDataMessages=[],this.tryCleanupConnection()}else"s"===e?this.br(n):"r"===e?this.Cr(n):"e"===e?Object(cr.k)("Server Error: "+n):"o"===e?(this.X("got pong on primary."),this.gr(),this.Er()):Object(cr.k)("Unknown control packet command: "+e)}},t.prototype.mr=function(t){var e=t.ts,n=t.v,r=t.h;this.sessionId=t.s,this.Hn.updateHost(r),0==this.zn&&(this.$n.start(),this.wr(this.$n,e),lr.e!==n&&Object(cr.B)("Protocol version mismatch detected"),this.Or())},t.prototype.Or=function(){var t=this.Gn.upgradeTransport();t&&this.Sr(t)},t.prototype.Sr=function(t){var e=this;this.ir=new t(this.Jn(),this.Hn,this.sessionId),this.fr=t.responsesRequiredToBeHealthy||0;var n=this.tr(this.ir),r=this.er(this.ir);this.ir.open(n,r),Object(cr.x)(function(){e.ir&&(e.X("Timed out trying to upgrade."),e.ir.close())},Math.floor(6e4))},t.prototype.Cr=function(t){this.X("Reset packet received.  New host: "+t),this.Hn.updateHost(t),1===this.zn?this.close():(this.Tr(),this.Xn())},t.prototype.wr=function(t,e){var n=this;this.X("Realtime connection established."),this.$n=t,this.zn=1,this.Kn&&(this.Kn(e,this.sessionId),this.Kn=null),0===this.Zn?(this.X("Primary connection is healthy."),this.or=!0):Object(cr.x)(function(){n.Er()},Math.floor(5e3))},t.prototype.Er=function(){this.or||1!==this.zn||(this.X("sending ping on primary."),this.lr({t:"c",d:{t:"p",d:{}}}))},t.prototype.ur=function(){var t=this.ir;this.ir=null,this.nr!==t&&this.rr!==t||this.close()},t.prototype.ar=function(t){this.$n=null,t||0!==this.zn?1===this.zn&&this.X("Realtime connection lost."):(this.X("Realtime connection failed."),this.Hn.isCacheableHost()&&(hr.a.remove("host:"+this.Hn.host),this.Hn.internalHost=this.Hn.host)),this.close()},t.prototype.br=function(t){this.X("Connection shutdown command received. Shutting down..."),this.Yn&&(this.Yn(t),this.Yn=null),this.An=null,this.close()},t.prototype.lr=function(t){if(1!==this.zn)throw"Connection is not connected";this.nr.send(t)},t.prototype.close=function(){2!==this.zn&&(this.X("Closing realtime connection."),this.zn=2,this.Tr(),this.An&&(this.An(),this.An=null))},t.prototype.Tr=function(){this.X("Shutting down all connections"),this.$n&&(this.$n.close(),this.$n=null),this.ir&&(this.ir.close(),this.ir=null),this.sr&&(clearTimeout(this.sr),this.sr=null)},t}(),dr=function(){function t(){}return t.prototype.put=function(t,e,n,r){},t.prototype.merge=function(t,e,n,r){},t.prototype.refreshAuthToken=function(t){},t.prototype.onDisconnectPut=function(t,e,n){},t.prototype.onDisconnectMerge=function(t,e,n){},t.prototype.onDisconnectCancel=function(t,e){},t.prototype.reportStats=function(t){},t}(),fr=n(5),_r=n(2),yr=n(3),vr=n(0),gr=n(1),mr=n(7),br=n(6),Cr="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Er=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),wr=1e3,Or=3e5,Sr=function(t){function e(n,r,i,o,s,a){var u=t.call(this)||this;if(u.Hn=n,u.Nr=r,u.Ir=i,u.Pr=o,u.Rr=s,u.Dr=a,u.id=e.jr++,u.X=Object(gr.t)("p:"+u.id+":"),u.xr={},u.kr={},u.Fr=[],u.Ar=0,u.Lr=[],u.Mr=!1,u.Wr=wr,u.qr=Or,u.Qr=null,u.lastSessionId=null,u.Ur=null,u.xn=!1,u.Vr={},u.Br=0,u.Hr=null,u.Kr=null,u.Yr=!1,u.zr=0,u.Gr=!0,u.Xr=null,u.$r=null,a&&!Object(br.b)())throw Error("Auth override specified in options, but not supported on non Node.js platforms");return u.Jr(0),Mn.getInstance().on("visible",u.Zr,u),-1===n.host.indexOf("fblocal")&&Un.getInstance().on("online",u.ti,u),u}return Er(e,t),e.prototype.sendRequest=function(t,e,n){var r=++this.Br,i={r:r,a:t,b:e};this.X(Object(yr.b)(i)),Object(vr.a)(this.Mr,"sendRequest call when we're not connected not allowed."),this.Hr.sendRequest(i),n&&(this.Vr[r]=n)},e.prototype.listen=function(t,e,n,r){var i=t.queryIdentifier(),o=""+t.path;this.X("Listen called for "+o+" "+i),this.kr[o]=this.kr[o]||{},Object(vr.a)(t.getQueryParams().isDefault()||!t.getQueryParams().loadsAllData(),"listen() called for non-default but complete query"),Object(vr.a)(!this.kr[o][i],"listen() called twice for same path/queryId.");var s={onComplete:r,hashFn:e,query:t,tag:n};this.kr[o][i]=s,this.Mr&&this.ei(s)},e.prototype.ei=function(t){var n=this,r=t.query,i=""+r.path,o=r.queryIdentifier();this.X("Listen on "+i+" for "+o);var s={p:i};t.tag&&(s.q=r.queryObject(),s.t=t.tag),s.h=t.hashFn(),this.sendRequest("q",s,function(s){var a=s.d,u=s.s;e.ni(a,r),(n.kr[i]&&n.kr[i][o])===t&&(n.X("listen response",s),"ok"!==u&&n.ri(i,o),t.onComplete&&t.onComplete(u,a))})},e.ni=function(t,e){if(t&&"object"===(void 0===t?"undefined":Cr(t))&&Object(_r.b)(t,"w")){var n=Object(_r.l)(t,"w");if(Array.isArray(n)&&~n.indexOf("no_index")){var r='".indexOn": "'+e.getQueryParams().getIndex()+'"',i=""+e.path;Object(gr.B)("Using an unspecified index. Consider adding "+r+" at "+i+" to your security rules for better performance")}}},e.prototype.refreshAuthToken=function(t){this.Kr=t,this.X("Auth token refreshed"),this.Kr?this.tryAuth():this.Mr&&this.sendRequest("unauth",{},function(){}),this.ii(t)},e.prototype.ii=function(t){(t&&40===t.length||zn(t))&&(this.X("Admin auth credential detected.  Reducing max reconnect time."),this.qr=3e4)},e.prototype.tryAuth=function(){var t=this;if(this.Mr&&this.Kr){var e=this.Kr,n=Yn(e)?"auth":"gauth",r={cred:e};null===this.Dr?r.noauth=!0:"object"===Cr(this.Dr)&&(r.authvar=this.Dr),this.sendRequest(n,r,function(n){var r=n.s,i=n.d||"error";t.Kr===e&&("ok"===r?t.zr=0:t.oi(r,i))})}},e.prototype.unlisten=function(t,e){var n=""+t.path,r=t.queryIdentifier();this.X("Unlisten called for "+n+" "+r),Object(vr.a)(t.getQueryParams().isDefault()||!t.getQueryParams().loadsAllData(),"unlisten() called for non-default but complete query"),this.ri(n,r)&&this.Mr&&this.si(n,r,t.queryObject(),e)},e.prototype.si=function(t,e,n,r){this.X("Unlisten on "+t+" for "+e);var i={p:t};r&&(i.q=n,i.t=r),this.sendRequest("n",i)},e.prototype.onDisconnectPut=function(t,e,n){this.Mr?this.ai("o",t,e,n):this.Lr.push({pathString:t,action:"o",data:e,onComplete:n})},e.prototype.onDisconnectMerge=function(t,e,n){this.Mr?this.ai("om",t,e,n):this.Lr.push({pathString:t,action:"om",data:e,onComplete:n})},e.prototype.onDisconnectCancel=function(t,e){this.Mr?this.ai("oc",t,null,e):this.Lr.push({pathString:t,action:"oc",data:null,onComplete:e})},e.prototype.ai=function(t,e,n,r){var i={p:e,d:n};this.X("onDisconnect "+t,i),this.sendRequest(t,i,function(t){r&&setTimeout(function(){r(t.s,t.d)},Math.floor(0))})},e.prototype.put=function(t,e,n,r){this.putInternal("p",t,e,n,r)},e.prototype.merge=function(t,e,n,r){this.putInternal("m",t,e,n,r)},e.prototype.putInternal=function(t,e,n,r,i){var o={p:e,d:n};void 0!==i&&(o.h=i),this.Fr.push({action:t,request:o,onComplete:r}),this.Ar++;var s=this.Fr.length-1;this.Mr?this.ui(s):this.X("Buffering put: "+e)},e.prototype.ui=function(t){var e=this,n=this.Fr[t].action,r=this.Fr[t].request,i=this.Fr[t].onComplete;this.Fr[t].queued=this.Mr,this.sendRequest(n,r,function(r){e.X(n+" response",r),delete e.Fr[t],e.Ar--,0===e.Ar&&(e.Fr=[]),i&&i(r.s,r.d)})},e.prototype.reportStats=function(t){var e=this;if(this.Mr){var n={c:t};this.X("reportStats",n),this.sendRequest("s",n,function(t){if("ok"!==t.s){var n=t.d;e.X("reportStats","Error sending stats: "+n)}})}},e.prototype.vr=function(t){if("r"in t){this.X("from server: "+Object(yr.b)(t));var e=t.r,n=this.Vr[e];n&&(delete this.Vr[e],n(t.b))}else{if("error"in t)throw"A server-side error has occurred: "+t.error;"a"in t&&this.ci(t.a,t.b)}},e.prototype.ci=function(t,e){this.X("handleServerMessage",t,e),"d"===t?this.Nr(e.p,e.d,!1,e.t):"m"===t?this.Nr(e.p,e.d,!0,e.t):"c"===t?this.hi(e.p,e.q):"ac"===t?this.oi(e.s,e.d):"sd"===t?this.li(e):Object(gr.k)("Unrecognized action received from server: "+Object(yr.b)(t)+"\nAre you using the latest client?")},e.prototype.Kn=function(t,e){this.X("connection ready"),this.Mr=!0,this.$r=(new Date).getTime(),this.pi(t),this.lastSessionId=e,this.Gr&&this.di(),this.fi(),this.Gr=!1,this.Ir(!0)},e.prototype.Jr=function(t){var e=this;Object(vr.a)(!this.Hr,"Scheduling a connect when we're already connected/ing?"),this.Ur&&clearTimeout(this.Ur),this.Ur=setTimeout(function(){e.Ur=null,e._i()},Math.floor(t))},e.prototype.Zr=function(t){t&&!this.xn&&this.Wr===this.qr&&(this.X("Window became visible.  Reducing delay."),this.Wr=wr,this.Hr||this.Jr(0)),this.xn=t},e.prototype.ti=function(t){t?(this.X("Browser went online."),this.Wr=wr,this.Hr||this.Jr(0)):(this.X("Browser went offline.  Killing connection."),this.Hr&&this.Hr.close())},e.prototype.yi=function(){if(this.X("data client disconnected"),this.Mr=!1,this.Hr=null,this.vi(),this.Vr={},this.gi()){if(this.xn){if(this.$r){var t=(new Date).getTime()-this.$r;t>3e4&&(this.Wr=wr),this.$r=null}}else this.X("Window isn't visible.  Delaying reconnect."),this.Wr=this.qr,this.Xr=(new Date).getTime();var e=(new Date).getTime()-this.Xr,n=Math.max(0,this.Wr-e);n=Math.random()*n,this.X("Trying to reconnect in "+n+"ms"),this.Jr(n),this.Wr=Math.min(this.qr,1.3*this.Wr)}this.Ir(!1)},e.prototype._i=function(){if(this.gi()){this.X("Making a connection attempt"),this.Xr=(new Date).getTime(),this.$r=null;var t=this.vr.bind(this),n=this.Kn.bind(this),r=this.yi.bind(this),i=this.id+":"+e.mi++,o=this,s=this.lastSessionId,a=!1,u=null,c=function(){u?u.close():(a=!0,r())},h=function(t){Object(vr.a)(u,"sendRequest call when we're not connected not allowed."),u.sendRequest(t)};this.Hr={close:c,sendRequest:h};var l=this.Yr;this.Yr=!1,this.Rr.getToken(l).then(function(e){a?Object(gr.s)("getToken() completed but was canceled"):(Object(gr.s)("getToken() completed. Creating connection."),o.Kr=e&&e.accessToken,u=new pr(i,o.Hn,t,n,r,function(t){Object(gr.B)(t+" ("+o.Hn+")"),o.interrupt("server_kill")},s))}).then(null,function(t){o.X("Failed to get token: "+t),a||(mr.a.NODE_ADMIN&&Object(gr.B)(t),c())})}},e.prototype.interrupt=function(t){Object(gr.s)("Interrupting connection for reason: "+t),this.xr[t]=!0,this.Hr?this.Hr.close():(this.Ur&&(clearTimeout(this.Ur),this.Ur=null),this.Mr&&this.yi())},e.prototype.resume=function(t){Object(gr.s)("Resuming connection for reason: "+t),delete this.xr[t],Object(_r.j)(this.xr)&&(this.Wr=wr,this.Hr||this.Jr(0))},e.prototype.pi=function(t){var e=t-(new Date).getTime();this.Pr({serverTimeOffset:e})},e.prototype.vi=function(){for(var t=0;t<this.Fr.length;t++){var e=this.Fr[t];e&&"h"in e.request&&e.queued&&(e.onComplete&&e.onComplete("disconnect"),delete this.Fr[t],this.Ar--)}0===this.Ar&&(this.Fr=[])},e.prototype.hi=function(t,e){var n;n=e?e.map(function(t){return Object(gr.d)(t)}).join("$"):"default";var r=this.ri(t,n);r&&r.onComplete&&r.onComplete("permission_denied")},e.prototype.ri=function(t,e){var n,r=""+new v(t);return void 0!==this.kr[r]?(n=this.kr[r][e],delete this.kr[r][e],0===Object(_r.h)(this.kr[r])&&delete this.kr[r]):n=void 0,n},e.prototype.oi=function(t,e){Object(gr.s)("Auth token revoked: "+t+"/"+e),this.Kr=null,this.Yr=!0,this.Hr.close(),"invalid_token"!==t&&"permission_denied"!==t||++this.zr>=3&&(this.Wr=3e4,this.Rr.notifyForInvalidToken())},e.prototype.li=function(t){this.Qr?this.Qr(t):"msg"in t&&"undefined"!=typeof console&&console.log("FIREBASE: "+t.msg.replace("\n","\nFIREBASE: "))},e.prototype.fi=function(){var t=this;this.tryAuth(),Object(_r.f)(this.kr,function(e,n){Object(_r.f)(n,function(e,n){t.ei(n)})});for(var e=0;e<this.Fr.length;e++)this.Fr[e]&&this.ui(e);for(;this.Lr.length;){var n=this.Lr.shift();this.ai(n.action,n.pathString,n.data,n.onComplete)}},e.prototype.di=function(){var t={},e="js";mr.a.NODE_ADMIN?e="admin_node":mr.a.NODE_CLIENT&&(e="node"),t["sdk."+e+"."+fr.default.SDK_VERSION.replace(/\./g,"-")]=1,Object(br.a)()?t["framework.cordova"]=1:Object(br.c)()&&(t["framework.reactnative"]=1),this.reportStats(t)},e.prototype.gi=function(){var t=Un.getInstance().currentlyOnline();return Object(_r.j)(this.xr)&&t},e.jr=0,e.mi=0,e}(dr),Tr=n(2),Nr=function(t){var e=[];return Object(Tr.f)(t,function(t,n){Array.isArray(n)?n.forEach(function(n){e.push(encodeURIComponent(t)+"="+encodeURIComponent(n))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(n))}),e.length?"&"+e.join("&"):""},Ir=n(0),Pr=n(1),Rr=n(3),Dr=n(2),jr=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),xr=function(t){function e(e,n,r){var i=t.call(this)||this;return i.Hn=e,i.Nr=n,i.Rr=r,i.X=Object(Pr.t)("p:rest:"),i.kr={},i}return jr(e,t),e.prototype.reportStats=function(t){throw Error("Method not implemented.")},e.bi=function(t,e){return void 0!==e?"tag$"+e:(Object(Ir.a)(t.getQueryParams().isDefault(),"should have a tag if it's not a default query."),""+t.path)},e.prototype.listen=function(t,n,r,i){var o=this,s=""+t.path;this.X("Listen called for "+s+" "+t.queryIdentifier());var a=e.bi(t,r),u={};this.kr[a]=u;var c=t.getQueryParams().toRestQueryStringParameters();this.Ci(s+".json",c,function(t,e){var n=e;if(404===t&&(n=null,t=null),null===t&&o.Nr(s,n,!1,r),Object(Dr.l)(o.kr,a)===u){var c;c=t?401==t?"permission_denied":"rest_error:"+t:"ok",i(c,null)}})},e.prototype.unlisten=function(t,n){var r=e.bi(t,n);delete this.kr[r]},e.prototype.refreshAuthToken=function(t){},e.prototype.Ci=function(t,e,n){var r=this;void 0===e&&(e={}),e.format="export",this.Rr.getToken(!1).then(function(i){var o=i&&i.accessToken;o&&(e.auth=o);var s=(r.Hn.secure?"https://":"http://")+r.Hn.host+t+"?"+Nr(e);r.X("Sending REST request for "+s);var a=new XMLHttpRequest;a.onreadystatechange=function(){if(n&&4===a.readyState){r.X("REST Response for "+s+" received. status:",a.status,"response:",a.responseText);var t=null;if(a.status>=200&&a.status<300){try{t=Object(Rr.a)(a.responseText)}catch(t){Object(Pr.B)("Failed to parse JSON response for "+s+": "+a.responseText)}n(null,t)}else 401!==a.status&&404!==a.status&&Object(Pr.B)("Got unsuccessful REST response for "+s+" Status: "+a.status),n(a.status);n=null}},a.open("GET",s,!0),a.send()})},e}(dr),kr=n(3),Fr=n(1),Ar=n(2),Lr=n(12),Mr="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Wr=function(){function t(t,e,n){var r=this;this.Hn=t,this.app=n,this.dataUpdateCount=0,this.On=null,this.Ei=new jn,this.wi=1,this.Oi=null,this.An=new Ce,this.Si=null;var i=new wn(n);if(this.$=Lr.a.getCollection(t),e||Object(Fr.g)())this.En=new xr(this.Hn,this.Nr.bind(this),i),setTimeout(this.Ir.bind(this,!0),0);else{var o=n.options.databaseAuthVariableOverride;if(void 0!==o&&null!==o){if("object"!==(void 0===o?"undefined":Mr(o)))throw Error("Only objects are supported for option databaseAuthVariableOverride");try{Object(kr.b)(o)}catch(t){throw Error("Invalid authOverride provided: "+t)}}this.Si=new Sr(this.Hn,this.Nr.bind(this),this.Ir.bind(this),this.Pr.bind(this),i,o),this.En=this.Si}i.addTokenChangeListener(function(t){r.En.refreshAuthToken(t)}),this.Ti=Lr.a.getOrCreateReporter(t,function(){return new Rn(r.$,r.En)}),this.Ni(),this.Ii=new Cn,this.Pi=new bn({startListening:function(t,e,n,i){var o=[],s=r.Ii.getNode(t.path);return s.isEmpty()||(o=r.Pi.applyServerOverwrite(t.path,s),setTimeout(function(){i("ok")},0)),o},stopListening:function(){}}),this.Ri("connected",!1),this.Di=new bn({startListening:function(t,e,n,i){return r.En.listen(t,n,e,function(e,n){var o=i(e,n);r.Ei.raiseEventsForChangedPath(t.path,o)}),[]},stopListening:function(t,e){r.En.unlisten(t,e)}})}return t.prototype.toString=function(){return(this.Hn.secure?"https://":"http://")+this.Hn.host},t.prototype.name=function(){return this.Hn.namespace},t.prototype.serverTime=function(){var t=this.Ii.getNode(new v(".info/serverTimeOffset")),e=t.val()||0;return(new Date).getTime()+e},t.prototype.generateServerValues=function(){return Oe({timestamp:this.serverTime()})},t.prototype.Nr=function(t,e,n,r){this.dataUpdateCount++;var i=new v(t);e=this.Oi?this.Oi(t,e):e;var o=[];if(r)if(n){var s=Object(Ar.k)(e,function(t){return a(t)});o=this.Di.applyTaggedQueryMerge(i,s,r)}else{var u=a(e);o=this.Di.applyTaggedQueryOverwrite(i,u,r)}else if(n){var c=Object(Ar.k)(e,function(t){return a(t)});o=this.Di.applyServerMerge(i,c)}else{var h=a(e);o=this.Di.applyServerOverwrite(i,h)}var l=i;o.length>0&&(l=this.ji(i)),this.Ei.raiseEventsForChangedPath(l,o)},t.prototype.xi=function(t){this.Oi=t},t.prototype.Ir=function(t){this.Ri("connected",t),!1===t&&this.ki()},t.prototype.Pr=function(t){var e=this;Object(Fr.i)(t,function(t,n){e.Ri(n,t)})},t.prototype.Ri=function(t,e){var n=new v("/.info/"+t),r=a(e);this.Ii.updateSnapshot(n,r);var i=this.Pi.applyServerOverwrite(n,r);this.Ei.raiseEventsForChangedPath(n,i)},t.prototype.Fi=function(){return this.wi++},t.prototype.setWithPriority=function(t,e,n,r){var i=this;this.X("set",{path:""+t,value:e,priority:n});var o=this.generateServerValues(),s=a(e,n),u=Ne(s,o),c=this.Fi(),h=this.Di.applyUserOverwrite(t,u,c,!0);this.Ei.queueEvents(h),this.En.put(""+t,s.val(!0),function(e,n){var o="ok"===e;o||Object(Fr.B)("set at "+t+" failed: "+e);var s=i.Di.ackUserWrite(c,!o);i.Ei.raiseEventsForChangedPath(t,s),i.callOnCompleteCallback(r,e,n)});var l=this.Ai(t);this.ji(l),this.Ei.raiseEventsForChangedPath(l,[])},t.prototype.update=function(t,e,n){var r=this;this.X("update",{path:""+t,value:e});var i=!0,o=this.generateServerValues(),s={};if(Object(Ar.f)(e,function(t,e){i=!1;var n=a(e);s[t]=Ne(n,o)}),i)Object(Fr.s)("update() called with empty data.  Don't do anything."),this.callOnCompleteCallback(n,"ok");else{var u=this.Fi(),c=this.Di.applyUserMerge(t,s,u);this.Ei.queueEvents(c),this.En.merge(""+t,e,function(e,i){var o="ok"===e;o||Object(Fr.B)("update at "+t+" failed: "+e);var s=r.Di.ackUserWrite(u,!o),a=s.length>0?r.ji(t):t;r.Ei.raiseEventsForChangedPath(a,s),r.callOnCompleteCallback(n,e,i)}),Object(Ar.f)(e,function(e){var n=r.Ai(t.child(e));r.ji(n)}),this.Ei.raiseEventsForChangedPath(t,[])}},t.prototype.ki=function(){var t=this;this.X("onDisconnectEvents");var e=this.generateServerValues(),n=Te(this.An,e),r=[];n.forEachTree(v.Empty,function(e,n){r=r.concat(t.Di.applyServerOverwrite(e,n));var i=t.Ai(e);t.ji(i)}),this.An=new Ce,this.Ei.raiseEventsForChangedPath(v.Empty,r)},t.prototype.onDisconnectCancel=function(t,e){var n=this;this.En.onDisconnectCancel(""+t,function(r,i){"ok"===r&&n.An.forget(t),n.callOnCompleteCallback(e,r,i)})},t.prototype.onDisconnectSet=function(t,e,n){var r=this,i=a(e);this.En.onDisconnectPut(""+t,i.val(!0),function(e,o){"ok"===e&&r.An.remember(t,i),r.callOnCompleteCallback(n,e,o)})},t.prototype.onDisconnectSetWithPriority=function(t,e,n,r){var i=this,o=a(e,n);this.En.onDisconnectPut(""+t,o.val(!0),function(e,n){"ok"===e&&i.An.remember(t,o),i.callOnCompleteCallback(r,e,n)})},t.prototype.onDisconnectUpdate=function(t,e,n){var r=this;if(Object(Ar.j)(e))return Object(Fr.s)("onDisconnect().update() called with empty data.  Don't do anything."),void this.callOnCompleteCallback(n,"ok");this.En.onDisconnectMerge(""+t,e,function(i,o){"ok"===i&&Object(Ar.f)(e,function(e,n){var i=a(n);r.An.remember(t.child(e),i)}),r.callOnCompleteCallback(n,i,o)})},t.prototype.addEventCallbackForQuery=function(t,e){var n;n=".info"===t.path.getFront()?this.Pi.addEventRegistration(t,e):this.Di.addEventRegistration(t,e),this.Ei.raiseEventsAtPath(t.path,n)},t.prototype.removeEventCallbackForQuery=function(t,e){var n;n=".info"===t.path.getFront()?this.Pi.removeEventRegistration(t,e):this.Di.removeEventRegistration(t,e),this.Ei.raiseEventsAtPath(t.path,n)},t.prototype.interrupt=function(){this.Si&&this.Si.interrupt("repo_interrupt")},t.prototype.resume=function(){this.Si&&this.Si.resume("repo_interrupt")},t.prototype.stats=function(t){if(void 0===t&&(t=!1),"undefined"!=typeof console){var e;t?(this.On||(this.On=new Sn(this.$)),e=this.On.get()):e=this.$.get();var n=Object.keys(e).reduce(function(t,e){return Math.max(e.length,t)},0);Object(Ar.f)(e,function(t,e){for(var r=t.length;r<n+2;r++)t+=" ";console.log(t+e)})}},t.prototype.statsIncrementCounter=function(t){this.$.incrementCounter(t),this.Ti.includeStat(t)},t.prototype.X=function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var n="";this.Si&&(n=this.Si.id+":"),Fr.s.apply(void 0,[n].concat(t))},t.prototype.callOnCompleteCallback=function(t,e,n){t&&Object(Fr.m)(function(){if("ok"==e)t(null);else{var r=(e||"error").toUpperCase(),i=r;n&&(i+=": "+n);var o=Error(i);o.code=r,t(o)}})},Object.defineProperty(t.prototype,"database",{get:function(){return this.Li||(this.Li=new pi(this))},enumerable:!0,configurable:!0}),t}(),qr=function(){function t(e){this.Mi=new Ke(e.getIndex()),this.Xt=e.getIndex(),this.Wi=t.qi(e),this.Qi=t.Ui(e)}return t.prototype.getStartPost=function(){return this.Wi},t.prototype.getEndPost=function(){return this.Qi},t.prototype.matches=function(t){return this.Xt.compare(this.getStartPost(),t)<=0&&this.Xt.compare(t,this.getEndPost())<=0},t.prototype.updateChild=function(t,e,n,r,i,o){return this.matches(new st(e,n))||(n=Vt.EMPTY_NODE),this.Mi.updateChild(t,e,n,r,i,o)},t.prototype.updateFullNode=function(t,e,n){e.isLeafNode()&&(e=Vt.EMPTY_NODE);var r=e.withIndex(this.Xt);r=r.updatePriority(Vt.EMPTY_NODE);var i=this;return e.forEachChild(Nt,function(t,e){i.matches(new st(t,e))||(r=r.updateImmediateChild(t,Vt.EMPTY_NODE))}),this.Mi.updateFullNode(t,r,n)},t.prototype.updatePriority=function(t,e){return t},t.prototype.filtersNodes=function(){return!0},t.prototype.getIndexedFilter=function(){return this.Mi},t.prototype.getIndex=function(){return this.Xt},t.qi=function(t){if(t.hasStart()){var e=t.getIndexStartName();return t.getIndex().makePost(t.getIndexStartValue(),e)}return t.getIndex().minPost()},t.Ui=function(t){if(t.hasEnd()){var e=t.getIndexEndName();return t.getIndex().makePost(t.getIndexEndValue(),e)}return t.getIndex().maxPost()},t}(),Qr=n(0),Ur=function(){function t(t){this.Vi=new qr(t),this.Xt=t.getIndex(),this.Bi=t.getLimit(),this.Hi=!t.isViewFromLeft()}return t.prototype.updateChild=function(t,e,n,r,i,o){return this.Vi.matches(new st(e,n))||(n=Vt.EMPTY_NODE),t.getImmediateChild(e).equals(n)?t:t.numChildren()<this.Bi?this.Vi.getIndexedFilter().updateChild(t,e,n,r,i,o):this.Ki(t,e,n,i,o)},t.prototype.updateFullNode=function(t,e,n){var r;if(e.isLeafNode()||e.isEmpty())r=Vt.EMPTY_NODE.withIndex(this.Xt);else if(2*this.Bi<e.numChildren()&&e.isIndexed(this.Xt)){r=Vt.EMPTY_NODE.withIndex(this.Xt);var i=void 0;i=this.Hi?e.getReverseIteratorFrom(this.Vi.getEndPost(),this.Xt):e.getIteratorFrom(this.Vi.getStartPost(),this.Xt);for(var o=0;i.hasNext()&&o<this.Bi;){var s=i.getNext(),a=void 0;if(!(a=this.Hi?this.Xt.compare(this.Vi.getStartPost(),s)<=0:this.Xt.compare(s,this.Vi.getEndPost())<=0))break;r=r.updateImmediateChild(s.name,s.node),o++}}else{r=e.withIndex(this.Xt),r=r.updatePriority(Vt.EMPTY_NODE);var u=void 0,c=void 0,h=void 0,i=void 0;if(this.Hi){i=r.getReverseIterator(this.Xt),u=this.Vi.getEndPost(),c=this.Vi.getStartPost();var l=this.Xt.getCompare();h=function(t,e){return l(e,t)}}else i=r.getIterator(this.Xt),u=this.Vi.getStartPost(),c=this.Vi.getEndPost(),h=this.Xt.getCompare();for(var o=0,p=!1;i.hasNext();){var s=i.getNext();!p&&h(u,s)<=0&&(p=!0);var a=p&&o<this.Bi&&h(s,c)<=0;a?o++:r=r.updateImmediateChild(s.name,Vt.EMPTY_NODE)}}return this.Vi.getIndexedFilter().updateFullNode(t,r,n)},t.prototype.updatePriority=function(t,e){return t},t.prototype.filtersNodes=function(){return!0},t.prototype.getIndexedFilter=function(){return this.Vi.getIndexedFilter()},t.prototype.getIndex=function(){return this.Xt},t.prototype.Ki=function(t,e,n,r,i){var o;if(this.Hi){var s=this.Xt.getCompare();o=function(t,e){return s(e,t)}}else o=this.Xt.getCompare();var a=t;Object(Qr.a)(a.numChildren()==this.Bi,"");var u=new st(e,n),c=this.Hi?a.getFirstChild(this.Xt):a.getLastChild(this.Xt),h=this.Vi.matches(u);if(a.hasChild(e)){for(var l=a.getImmediateChild(e),p=r.getChildAfterChild(this.Xt,c,this.Hi);null!=p&&(p.name==e||a.hasChild(p.name));)p=r.getChildAfterChild(this.Xt,p,this.Hi);var d=null==p?1:o(p,u);if(h&&!n.isEmpty()&&d>=0)return null!=i&&i.trackChildChange(Be.childChangedChange(e,n,l)),a.updateImmediateChild(e,n);null!=i&&i.trackChildChange(Be.childRemovedChange(e,l));var f=a.updateImmediateChild(e,Vt.EMPTY_NODE);return null!=p&&this.Vi.matches(p)?(null!=i&&i.trackChildChange(Be.childAddedChange(p.name,p.node)),f.updateImmediateChild(p.name,p.node)):f}return n.isEmpty()?t:h&&o(c,u)>=0?(null!=i&&(i.trackChildChange(Be.childRemovedChange(c.name,c.node)),i.trackChildChange(Be.childAddedChange(e,n))),a.updateImmediateChild(e,n).updateImmediateChild(c.name,Vt.EMPTY_NODE)):t},t}(),Vr=n(0),Br=n(1),Hr=n(3),Kr=function(){function t(){this.Yi=!1,this.zi=!1,this.Gi=!1,this.Xi=!1,this.$i=!1,this.Bi=0,this.Ji="",this.Zi=null,this.to="",this.eo=null,this.no="",this.Xt=Nt}return t.prototype.hasStart=function(){return this.zi},t.prototype.isViewFromLeft=function(){return""===this.Ji?this.zi:this.Ji===t.ro.VIEW_FROM_LEFT},t.prototype.getIndexStartValue=function(){return Object(Vr.a)(this.zi,"Only valid if start has been set"),this.Zi},t.prototype.getIndexStartName=function(){return Object(Vr.a)(this.zi,"Only valid if start has been set"),this.Gi?this.to:Br.c},t.prototype.hasEnd=function(){return this.Xi},t.prototype.getIndexEndValue=function(){return Object(Vr.a)(this.Xi,"Only valid if end has been set"),this.eo},t.prototype.getIndexEndName=function(){return Object(Vr.a)(this.Xi,"Only valid if end has been set"),this.$i?this.no:Br.b},t.prototype.hasLimit=function(){return this.Yi},t.prototype.hasAnchoredLimit=function(){return this.Yi&&""!==this.Ji},t.prototype.getLimit=function(){return Object(Vr.a)(this.Yi,"Only valid if limit has been set"),this.Bi},t.prototype.getIndex=function(){return this.Xt},t.prototype.io=function(){var e=new t;return e.Yi=this.Yi,e.Bi=this.Bi,e.zi=this.zi,e.Zi=this.Zi,e.Gi=this.Gi,e.to=this.to,e.Xi=this.Xi,e.eo=this.eo,e.$i=this.$i,e.no=this.no,e.Xt=this.Xt,e.Ji=this.Ji,e},t.prototype.limit=function(t){var e=this.io();return e.Yi=!0,e.Bi=t,e.Ji="",e},t.prototype.limitToFirst=function(e){var n=this.io();return n.Yi=!0,n.Bi=e,n.Ji=t.ro.VIEW_FROM_LEFT,n},t.prototype.limitToLast=function(e){var n=this.io();return n.Yi=!0,n.Bi=e,n.Ji=t.ro.VIEW_FROM_RIGHT,n},t.prototype.startAt=function(t,e){var n=this.io();return n.zi=!0,void 0===t&&(t=null),n.Zi=t,null!=e?(n.Gi=!0,n.to=e):(n.Gi=!1,n.to=""),n},t.prototype.endAt=function(t,e){var n=this.io();return n.Xi=!0,void 0===t&&(t=null),n.eo=t,void 0!==e?(n.$i=!0,n.no=e):(n.$i=!1,n.no=""),n},t.prototype.orderBy=function(t){var e=this.io();return e.Xt=t,e},t.prototype.getQueryObject=function(){var e=t.ro,n={};if(this.zi&&(n[e.INDEX_START_VALUE]=this.Zi,this.Gi&&(n[e.INDEX_START_NAME]=this.to)),this.Xi&&(n[e.INDEX_END_VALUE]=this.eo,this.$i&&(n[e.INDEX_END_NAME]=this.no)),this.Yi){n[e.LIMIT]=this.Bi;var r=this.Ji;""===r&&(r=this.isViewFromLeft()?e.VIEW_FROM_LEFT:e.VIEW_FROM_RIGHT),n[e.VIEW_FROM]=r}return this.Xt!==Nt&&(n[e.INDEX]=""+this.Xt),n},t.prototype.loadsAllData=function(){return!(this.zi||this.Xi||this.Yi)},t.prototype.isDefault=function(){return this.loadsAllData()&&this.Xt==Nt},t.prototype.getNodeFilter=function(){return this.loadsAllData()?new Ke(this.getIndex()):this.hasLimit()?new Ur(this):new qr(this)},t.prototype.toRestQueryStringParameters=function(){var e=t.oo,n={};if(this.isDefault())return n;var r;return this.Xt===Nt?r=e.PRIORITY_INDEX:this.Xt===ee?r=e.VALUE_INDEX:this.Xt===dt?r=e.KEY_INDEX:(Object(Vr.a)(this.Xt instanceof oe,"Unrecognized index type!"),r=""+this.Xt),n[e.ORDER_BY]=Object(Hr.b)(r),this.zi&&(n[e.START_AT]=Object(Hr.b)(this.Zi),this.Gi&&(n[e.START_AT]+=","+Object(Hr.b)(this.to))),this.Xi&&(n[e.END_AT]=Object(Hr.b)(this.eo),this.$i&&(n[e.END_AT]+=","+Object(Hr.b)(this.no))),this.Yi&&(this.isViewFromLeft()?n[e.LIMIT_TO_FIRST]=this.Bi:n[e.LIMIT_TO_LAST]=this.Bi),n},t.ro={INDEX_START_VALUE:"sp",INDEX_START_NAME:"sn",INDEX_END_VALUE:"ep",INDEX_END_NAME:"en",LIMIT:"l",VIEW_FROM:"vf",VIEW_FROM_LEFT:"l",VIEW_FROM_RIGHT:"r",INDEX:"i"},t.oo={ORDER_BY:"orderBy",PRIORITY_INDEX:"$priority",VALUE_INDEX:"$value",KEY_INDEX:"$key",START_AT:"startAt",END_AT:"endAt",LIMIT_TO_FIRST:"limitToFirst",LIMIT_TO_LAST:"limitToLast"},t.DEFAULT=new t,t}(),Yr=n(1),zr=n(4),Gr=this&&this.I||function(){var t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,e){t.__proto__=e}||function(t,e){for(var n in e)e.hasOwnProperty(n)&&(t[n]=e[n])};return function(e,n){function r(){this.constructor=e}t(e,n),e.prototype=null===n?Object.create(n):(r.prototype=n.prototype,new r)}}(),Xr=function(t){function e(e,n){if(!(e instanceof Wr))throw Error("new Reference() no longer supported - use app.database().");return t.call(this,e,n,Kr.DEFAULT,!1)||this}return Gr(e,t),e.prototype.getKey=function(){return P("Reference.key",0,0,arguments.length),this.path.isEmpty()?null:this.path.getBack()},e.prototype.child=function(t){return P("Reference.child",1,1,arguments.length),"number"==typeof t?t+="":t instanceof v||(null===this.path.getFront()?X("Reference.child",1,t,!1):G("Reference.child",1,t,!1)),new e(this.repo,this.path.child(t))},e.prototype.getParent=function(){P("Reference.parent",0,0,arguments.length);var t=this.path.parent();return null===t?null:new e(this.repo,t)},e.prototype.getRoot=function(){P("Reference.root",0,0,arguments.length);for(var t=this;null!==t.getParent();)t=t.getParent();return t},e.prototype.databaseProp=function(){return this.repo.database},e.prototype.set=function(t,e){P("Reference.set",1,2,arguments.length),$("Reference.set",this.path),U("Reference.set",1,t,this.path,!1),R("Reference.set",2,e,!0);var n=new zr.a;return this.repo.setWithPriority(this.path,t,null,n.wrapCallback(e)),n.promise},e.prototype.update=function(t,e){if(P("Reference.update",1,2,arguments.length),$("Reference.update",this.path),Array.isArray(t)){for(var n={},r=0;r<t.length;++r)n[""+r]=t[r];t=n,Object(Yr.B)("Passing an Array to Firebase.update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}H("Reference.update",1,t,this.path,!1),R("Reference.update",2,e,!0);var i=new zr.a;return this.repo.update(this.path,t,i.wrapCallback(e)),i.promise},e.prototype.setWithPriority=function(t,e,n){if(P("Reference.setWithPriority",2,3,arguments.length),$("Reference.setWithPriority",this.path),U("Reference.setWithPriority",1,t,this.path,!1),K("Reference.setWithPriority",2,e,!1),R("Reference.setWithPriority",3,n,!0),".length"===this.getKey()||".keys"===this.getKey())throw"Reference.setWithPriority failed: "+this.getKey()+" is a read-only object.";var r=new zr.a;return this.repo.setWithPriority(this.path,t,e,r.wrapCallback(n)),r.promise},e.prototype.remove=function(t){return P("Reference.remove",0,1,arguments.length),$("Reference.remove",this.path),R("Reference.remove",1,t,!0),this.set(null,t)},e.prototype.transaction=function(t,e,n){if(P("Reference.transaction",1,3,arguments.length),$("Reference.transaction",this.path),R("Reference.transaction",1,t,!1),R("Reference.transaction",2,e,!0),Z("Reference.transaction",3,n,!0),".length"===this.getKey()||".keys"===this.getKey())throw"Reference.transaction failed: "+this.getKey()+" is a read-only object.";void 0===n&&(n=!0);var r=new zr.a;"function"==typeof e&&Object(zr.c)(r.promise);var i=function(t,n,i){t?r.reject(t):r.resolve(new rt(n,i)),"function"==typeof e&&e(t,n,i)};return this.repo.startTransaction(this.path,t,i,n),r.promise},e.prototype.setPriority=function(t,e){P("Reference.setPriority",1,2,arguments.length),$("Reference.setPriority",this.path),K("Reference.setPriority",1,t,!1),R("Reference.setPriority",2,e,!0);var n=new zr.a;return this.repo.setWithPriority(this.path.child(".priority"),t,null,n.wrapCallback(e)),n.promise},e.prototype.push=function(t,e){P("Reference.push",0,2,arguments.length),$("Reference.push",this.path),U("Reference.push",1,t,this.path,!0),R("Reference.push",2,e,!0);var n,r=this.repo.serverTime(),i=ot(r),o=this.child(i),s=this.child(i);return n=null!=t?o.set(t,e).then(function(){return s}):zr.b.resolve(s),o.then=n.then.bind(n),o.catch=n.then.bind(n,void 0),"function"==typeof e&&Object(zr.c)(n),o},e.prototype.onDisconnect=function(){return $("Reference.onDisconnect",this.path),new nt(this.repo,this.path)},Object.defineProperty(e.prototype,"database",{get:function(){return this.databaseProp()},enumerable:!0,configurable:!0}),Object.defineProperty(e.prototype,"key",{get:function(){return this.getKey()},enumerable:!0,configurable:!0}),Object.defineProperty(e.prototype,"parent",{get:function(){return this.getParent()},enumerable:!0,configurable:!0}),Object.defineProperty(e.prototype,"root",{get:function(){return this.getRoot()},enumerable:!0,configurable:!0}),e}(ge);ge.se=Xr,cn.se=Xr;var $r,Jr=n(0),Zr=n(2),ti=function(){function t(){this.children={},this.childCount=0,this.value=null}return t}(),ei=function(){function t(t,e,n){void 0===t&&(t=""),void 0===e&&(e=null),void 0===n&&(n=new ti),this.so=t,this.ao=e,this.zt=n}return t.prototype.subTree=function(e){for(var n,r=e instanceof v?e:new v(e),i=this;null!==(n=r.getFront());)i=new t(n,i,Object(Zr.l)(i.zt.children,n)||new ti),r=r.popFront();return i},t.prototype.getValue=function(){return this.zt.value},t.prototype.setValue=function(t){Object(Jr.a)(void 0!==t,"Cannot set value to undefined"),this.zt.value=t,this.uo()},t.prototype.clear=function(){this.zt.value=null,this.zt.children={},this.zt.childCount=0,this.uo()},t.prototype.hasChildren=function(){return this.zt.childCount>0},t.prototype.isEmpty=function(){return null===this.getValue()&&!this.hasChildren()},t.prototype.forEachChild=function(e){var n=this;Object(Zr.f)(this.zt.children,function(r,i){e(new t(r,n,i))})},t.prototype.forEachDescendant=function(t,e,n){e&&!n&&t(this),this.forEachChild(function(e){e.forEachDescendant(t,!0,n)}),e&&n&&t(this)},t.prototype.forEachAncestor=function(t,e){for(var n=e?this:this.parent();null!==n;){if(t(n))return!0;n=n.parent()}return!1},t.prototype.forEachImmediateDescendantWithValue=function(t){this.forEachChild(function(e){null!==e.getValue()?t(e):e.forEachImmediateDescendantWithValue(t)})},t.prototype.path=function(){return new v(null===this.ao?this.so:this.ao.path()+"/"+this.so)},t.prototype.name=function(){return this.so},t.prototype.parent=function(){return this.ao},t.prototype.uo=function(){null!==this.ao&&this.ao.co(this.so,this)},t.prototype.co=function(t,e){var n=e.isEmpty(),r=Object(Zr.b)(this.zt.children,t);n&&r?(delete this.zt.children[t],this.zt.childCount--,this.uo()):n||r||(this.zt.children[t]=e.zt,this.zt.childCount++,this.uo())},t}(),ni=n(0),ri=n(1),ii=n(2),oi="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};!function(t){t[t.RUN=0]="RUN",t[t.SENT=1]="SENT",t[t.COMPLETED=2]="COMPLETED",t[t.SENT_NEEDS_ABORT=3]="SENT_NEEDS_ABORT",t[t.NEEDS_ABORT=4]="NEEDS_ABORT"}($r||($r={})),Wr.ho=25,Wr.prototype.Ni=function(){this.lo=new ei},Wr.prototype.startTransaction=function(t,e,n,r){this.X("transaction on "+t);var i=function(){},o=new Xr(this,t);o.on("value",i);var s=function(){o.off("value",i)},u={path:t,update:e,onComplete:n,status:null,order:Object(ri.a)(),applyLocally:r,retryCount:0,unwatcher:s,abortReason:null,currentWriteId:null,currentInputSnapshot:null,currentOutputSnapshotRaw:null,currentOutputSnapshotResolved:null},c=this.po(t);u.currentInputSnapshot=c;var h=u.update(c.val());if(void 0===h){if(u.unwatcher(),u.currentOutputSnapshotRaw=null,u.currentOutputSnapshotResolved=null,u.onComplete){var l=new se(u.currentInputSnapshot,new Xr(this,u.path),Nt);u.onComplete(null,!1,l)}}else{V("transaction failed: Data returned ",h,u.path),u.status=$r.RUN;var p=this.lo.subTree(t),d=p.getValue()||[];d.push(u),p.setValue(d);var f=void 0;"object"===(void 0===h?"undefined":oi(h))&&null!==h&&Object(ii.b)(h,".priority")?(f=Object(ii.l)(h,".priority"),Object(ni.a)(Q(f),"Invalid priority returned by transaction. Priority must be a valid string, finite number, server value, or null.")):f=(this.Di.calcCompleteEventCache(t)||Vt.EMPTY_NODE).getPriority().val(),f=f;var _=this.generateServerValues(),y=a(h,f),v=Ne(y,_);u.currentOutputSnapshotRaw=y,u.currentOutputSnapshotResolved=v,u.currentWriteId=this.Fi();var g=this.Di.applyUserOverwrite(t,v,u.currentWriteId,u.applyLocally);this.Ei.raiseEventsForChangedPath(t,g),this.do()}},Wr.prototype.po=function(t,e){return this.Di.calcCompleteEventCache(t,e)||Vt.EMPTY_NODE},Wr.prototype.do=function(t){var e=this;if(void 0===t&&(t=this.lo),t||this.fo(t),null!==t.getValue()){var n=this._o(t);Object(ni.a)(n.length>0,"Sending zero length transaction queue"),n.every(function(t){return t.status===$r.RUN})&&this.yo(t.path(),n)}else t.hasChildren()&&t.forEachChild(function(t){e.do(t)})},Wr.prototype.yo=function(t,e){for(var n=this,r=e.map(function(t){return t.currentWriteId}),i=this.po(t,r),o=i,s=i.hash(),a=0;a<e.length;a++){var u=e[a];Object(ni.a)(u.status===$r.RUN,"tryToSendTransactionQueue_: items in queue should all be run."),u.status=$r.SENT,u.retryCount++;var c=v.relativePath(t,u.path);o=o.updateChild(c,u.currentOutputSnapshotRaw)}var h=o.val(!0),l=t;this.En.put(""+l,h,function(r){n.X("transaction put response",{path:""+l,status:r});var i=[];if("ok"===r){for(var o=[],s=0;s<e.length;s++){if(e[s].status=$r.COMPLETED,i=i.concat(n.Di.ackUserWrite(e[s].currentWriteId)),e[s].onComplete){var a=e[s].currentOutputSnapshotResolved,u=new Xr(n,e[s].path),c=new se(a,u,Nt);o.push(e[s].onComplete.bind(null,null,!0,c))}e[s].unwatcher()}n.fo(n.lo.subTree(t)),n.do(),n.Ei.raiseEventsForChangedPath(t,i);for(var s=0;s<o.length;s++)Object(ri.m)(o[s])}else{if("datastale"===r)for(var s=0;s<e.length;s++)e[s].status===$r.SENT_NEEDS_ABORT?e[s].status=$r.NEEDS_ABORT:e[s].status=$r.RUN;else{Object(ri.B)("transaction at "+l+" failed: "+r);for(var s=0;s<e.length;s++)e[s].status=$r.NEEDS_ABORT,e[s].abortReason=r}n.ji(t)}},s)},Wr.prototype.ji=function(t){var e=this.vo(t),n=e.path(),r=this._o(e);return this.go(r,n),n},Wr.prototype.go=function(t,e){if(0!==t.length){for(var n=[],r=[],i=t.filter(function(t){return t.status===$r.RUN}),o=i.map(function(t){return t.currentWriteId}),s=0;s<t.length;s++){var u=t[s],c=v.relativePath(e,u.path),h=!1,l=void 0;if(Object(ni.a)(null!==c,"rerunTransactionsUnderNode_: relativePath should not be null."),u.status===$r.NEEDS_ABORT)h=!0,l=u.abortReason,r=r.concat(this.Di.ackUserWrite(u.currentWriteId,!0));else if(u.status===$r.RUN)if(u.retryCount>=Wr.ho)h=!0,l="maxretry",r=r.concat(this.Di.ackUserWrite(u.currentWriteId,!0));else{var p=this.po(u.path,o);u.currentInputSnapshot=p;var d=t[s].update(p.val());if(void 0!==d){V("transaction failed: Data returned ",d,u.path);var f=a(d),_="object"===(void 0===d?"undefined":oi(d))&&null!=d&&Object(ii.b)(d,".priority");_||(f=f.updatePriority(p.getPriority()));var y=u.currentWriteId,g=this.generateServerValues(),m=Ne(f,g);u.currentOutputSnapshotRaw=f,u.currentOutputSnapshotResolved=m,u.currentWriteId=this.Fi(),o.splice(o.indexOf(y),1),r=r.concat(this.Di.applyUserOverwrite(u.path,m,u.currentWriteId,u.applyLocally)),r=r.concat(this.Di.ackUserWrite(y,!0))}else h=!0,l="nodata",r=r.concat(this.Di.ackUserWrite(u.currentWriteId,!0))}if(this.Ei.raiseEventsForChangedPath(e,r),r=[],h&&(t[s].status=$r.COMPLETED,function(t){setTimeout(t,Math.floor(0))}(t[s].unwatcher),t[s].onComplete))if("nodata"===l){var b=new Xr(this,t[s].path),C=t[s].currentInputSnapshot,E=new se(C,b,Nt);n.push(t[s].onComplete.bind(null,null,!1,E))}else n.push(t[s].onComplete.bind(null,Error(l),!1,null))}this.fo(this.lo);for(var s=0;s<n.length;s++)Object(ri.m)(n[s]);this.do()}},Wr.prototype.vo=function(t){for(var e,n=this.lo;null!==(e=t.getFront())&&null===n.getValue();)n=n.subTree(e),t=t.popFront();return n},Wr.prototype._o=function(t){var e=[];return this.mo(t,e),e.sort(function(t,e){return t.order-e.order}),e},Wr.prototype.mo=function(t,e){var n=this,r=t.getValue();if(null!==r)for(var i=0;i<r.length;i++)e.push(r[i]);t.forEachChild(function(t){n.mo(t,e)})},Wr.prototype.fo=function(t){var e=this,n=t.getValue();if(n){for(var r=0,i=0;i<n.length;i++)n[i].status!==$r.COMPLETED&&(n[r]=n[i],r++);n.length=r,t.setValue(n.length>0?n:null)}t.forEachChild(function(t){e.fo(t)})},Wr.prototype.Ai=function(t){var e=this,n=this.vo(t).path(),r=this.lo.subTree(t);return r.forEachAncestor(function(t){e.bo(t)}),this.bo(r),r.forEachDescendant(function(t){e.bo(t)}),n},Wr.prototype.bo=function(t){var e=t.getValue();if(null!==e){for(var n=[],r=[],i=-1,o=0;o<e.length;o++)e[o].status===$r.SENT_NEEDS_ABORT||(e[o].status===$r.SENT?(Object(ni.a)(i===o-1,"All SENT items should be at beginning of queue."),i=o,e[o].status=$r.SENT_NEEDS_ABORT,e[o].abortReason="set"):(Object(ni.a)(e[o].status===$r.RUN,"Unexpected transaction status in abort"),e[o].unwatcher(),r=r.concat(this.Di.ackUserWrite(e[o].currentWriteId,!0)),e[o].onComplete&&n.push(e[o].onComplete.bind(null,Error("set"),!1,null))));-1===i?t.setValue(null):e.length=i+1,this.Ei.raiseEventsForChangedPath(t.path(),r);for(var o=0;o<n.length;o++)Object(ri.m)(n[o])}};var si,ai=n(2),ui=n(1),ci=function(){function t(){this.Co={},this.Eo=!1}return t.getInstance=function(){return si||(si=new t),si},t.prototype.interrupt=function(){for(var t in this.Co)this.Co[t].interrupt()},t.prototype.resume=function(){for(var t in this.Co)this.Co[t].resume()},t.prototype.databaseFromApp=function(t){var e=t.options.databaseURL;void 0===e&&Object(ui.o)("Can't determine Firebase Database URL.  Be sure to include databaseURL option when calling firebase.intializeApp().");var n=T(e),r=n.repoInfo;return J("Invalid Firebase Database URL",1,n),n.path.isEmpty()||Object(ui.o)("Database URL must point to the root of a Firebase Database (not including a child path)."),this.createRepo(r,t).database},t.prototype.deleteRepo=function(t){Object(ai.l)(this.Co,t.app.name)!==t&&Object(ui.o)("Database "+t.app.name+" has already been deleted."),t.interrupt(),delete this.Co[t.app.name]},t.prototype.createRepo=function(t,e){var n=Object(ai.l)(this.Co,e.name);return n&&Object(ui.o)("FIREBASE INTERNAL ERROR: Database initialized multiple times."),n=new Wr(t,this.Eo,e),this.Co[e.name]=n,n},t.prototype.forceRestClient=function(t){this.Eo=t},t}(),hi=n(1),li=n(4),pi=function(){function t(t){this._t=t,t instanceof Wr||Object(hi.o)("Don't call new Database() directly - please use firebase.database()."),this.Lt=new Xr(t,v.Empty),this.INTERNAL=new di(this)}return Object.defineProperty(t.prototype,"app",{get:function(){return this._t.app},enumerable:!0,configurable:!0}),t.prototype.ref=function(t){return this.wo("ref"),P("database.ref",0,1,arguments.length),void 0!==t?this.Lt.child(t):this.Lt},t.prototype.refFromURL=function(t){var e="database.refFromURL";this.wo(e),P(e,1,1,arguments.length);var n=T(t);J(e,1,n);var r=n.repoInfo;return r.host!==this._t.Hn.host&&Object(hi.o)(e+": Host name does not match the current database: (found "+r.host+" but expected "+this._t.Hn.host+")"),this.ref(""+n.path)},t.prototype.wo=function(t){null===this._t&&Object(hi.o)("Cannot call "+t+" on a deleted database.")},t.prototype.goOffline=function(){P("database.goOffline",0,0,arguments.length),this.wo("goOffline"),this._t.interrupt()},t.prototype.goOnline=function(){P("database.goOnline",0,0,arguments.length),this.wo("goOnline"),this._t.resume()},t.ServerValue={TIMESTAMP:{".sv":"timestamp"}},t}(),di=function(){function t(t){this.database=t}return t.prototype.delete=function(){return this.database.wo("delete"),ci.getInstance().deleteRepo(this.database._t),this.database._t=null,this.database.Lt=null,this.database.INTERNAL=null,this.database=null,li.b.resolve()},t}(),fi={};n.d(fi,"forceLongPolling",function(){return yi}),n.d(fi,"forceWebSockets",function(){return vi}),n.d(fi,"isWebSocketsAvailable",function(){return gi}),n.d(fi,"setSecurityDebugCallback",function(){return mi}),n.d(fi,"stats",function(){return bi}),n.d(fi,"statsIncrementCounter",function(){return Ci}),n.d(fi,"dataUpdateCount",function(){return Ei}),n.d(fi,"interceptServerData",function(){return wi});var _i=n(18),yi=function(){_i.a.forceDisallow(),ir.forceAllow()},vi=function(){ir.forceDisallow()},gi=function(){return _i.a.isAvailable()},mi=function(t,e){t.repo.Si.Qr=e},bi=function(t,e){t.repo.stats(e)},Ci=function(t,e){t.repo.statsIncrementCounter(e)},Ei=function(t){return t.repo.dataUpdateCount},wi=function(t,e){return t.repo.xi(e)},Oi={};n.d(Oi,"DataConnection",function(){return Si}),n.d(Oi,"RealTimeConnection",function(){return Ti}),n.d(Oi,"hijackHash",function(){return Ni}),n.d(Oi,"ConnectionTarget",function(){return Ii}),n.d(Oi,"queryIdentifier",function(){return Pi}),n.d(Oi,"listens",function(){return Ri}),n.d(Oi,"forceRestClient",function(){return Di});var Si=Sr;Sr.prototype.simpleListen=function(t,e){this.sendRequest("q",{p:t},e)},Sr.prototype.echo=function(t,e){this.sendRequest("echo",{d:t},e)};var Ti=pr,Ni=function(t){var e=Sr.prototype.put;return Sr.prototype.put=function(n,r,i,o){void 0!==o&&(o=t()),e.call(this,n,r,i,o)},function(){Sr.prototype.put=e}},Ii=O,Pi=function(t){return t.queryIdentifier()},Ri=function(t){return t.repo.Si.kr},Di=function(t){ci.getInstance().forceRestClient(t)};(function(t){function r(e){var n=e.INTERNAL.registerService("database",function(t){return ci.getInstance().databaseFromApp(t)},{Reference:Xr,Query:ge,Database:pi,enableLogging:o.j,INTERNAL:fi,ServerValue:pi.ServerValue,TEST_ACCESS:Oi});Object(s.b)()&&(t.exports=n)}e.registerDatabase=r;var i=n(5),o=n(1),s=n(6);r(i.default)}).call(e,n(26)(t))},function(t,e){t.exports=function(t){if(!t.webpackPolyfill){var e=Object.create(t);e.children||(e.children=[]),Object.defineProperty(e,"loaded",{enumerable:!0,get:function(){return e.l}}),Object.defineProperty(e,"id",{enumerable:!0,get:function(){return e.i}}),Object.defineProperty(e,"exports",{enumerable:!0}),e.webpackPolyfill=1}return e}}],[25])}catch(t){throw Error("Cannot instantiate firebase-database.js - be sure to load firebase-app.js first.")}

try{webpackJsonpFirebase([2],{24:function(e,t,r){"use strict";function n(e){var t=new Uint8Array(e);return window.btoa(String.fromCharCode.apply(null,t))}function o(e){var t=function(e){return self&&"ServiceWorkerGlobalScope"in self?new F(e):new D(e)},r={Messaging:D};e.INTERNAL.registerService("messaging",t,r)}Object.defineProperty(t,"__esModule",{value:!0});var i,s={AVAILABLE_IN_WINDOW:"only-available-in-window",AVAILABLE_IN_SW:"only-available-in-sw",SHOULD_BE_INHERITED:"should-be-overriden",BAD_SENDER_ID:"bad-sender-id",INCORRECT_GCM_SENDER_ID:"incorrect-gcm-sender-id",PERMISSION_DEFAULT:"permission-default",PERMISSION_BLOCKED:"permission-blocked",UNSUPPORTED_BROWSER:"unsupported-browser",NOTIFICATIONS_BLOCKED:"notifications-blocked",FAILED_DEFAULT_REGISTRATION:"failed-serviceworker-registration",SW_REGISTRATION_EXPECTED:"sw-registration-expected",GET_SUBSCRIPTION_FAILED:"get-subscription-failed",INVALID_SAVED_TOKEN:"invalid-saved-token",SW_REG_REDUNDANT:"sw-reg-redundant",TOKEN_SUBSCRIBE_FAILED:"token-subscribe-failed",TOKEN_SUBSCRIBE_NO_TOKEN:"token-subscribe-no-token",TOKEN_SUBSCRIBE_NO_PUSH_SET:"token-subscribe-no-push-set",USE_SW_BEFORE_GET_TOKEN:"use-sw-before-get-token",INVALID_DELETE_TOKEN:"invalid-delete-token",DELETE_TOKEN_NOT_FOUND:"delete-token-not-found",DELETE_SCOPE_NOT_FOUND:"delete-scope-not-found",BG_HANDLER_FUNCTION_EXPECTED:"bg-handler-function-expected",NO_WINDOW_CLIENT_TO_MSG:"no-window-client-to-msg",UNABLE_TO_RESUBSCRIBE:"unable-to-resubscribe",NO_FCM_TOKEN_FOR_RESUBSCRIBE:"no-fcm-token-for-resubscribe",FAILED_TO_DELETE_TOKEN:"failed-to-delete-token",NO_SW_IN_REG:"no-sw-in-reg",BAD_SCOPE:"bad-scope",BAD_VAPID_KEY:"bad-vapid-key",BAD_SUBSCRIPTION:"bad-subscription",BAD_TOKEN:"bad-token",BAD_PUSH_SET:"bad-push-set",FAILED_DELETE_VAPID_KEY:"failed-delete-vapid-key"},a=(i={},i[s.AVAILABLE_IN_WINDOW]="This method is available in a Window context.",i[s.AVAILABLE_IN_SW]="This method is available in a service worker context.",i["should-be-overriden"]="This method should be overriden by extended classes.",i["bad-sender-id"]="Please ensure that 'messagingSenderId' is set correctly in the options passed into firebase.initializeApp().",i["permission-default"]="The required permissions were not granted and dismissed instead.",i["permission-blocked"]="The required permissions were not granted and blocked instead.",i["unsupported-browser"]="This browser doesn't support the API's required to use the firebase SDK.",i["notifications-blocked"]="Notifications have been blocked.",i[s.FAILED_DEFAULT_REGISTRATION]="We are unable to register the default service worker. {$browserErrorMessage}",i["sw-registration-expected"]="A service worker registration was the expected input.",i["get-subscription-failed"]="There was an error when trying to get any existing Push Subscriptions.",i["invalid-saved-token"]="Unable to access details of the saved token.",i["sw-reg-redundant"]="The service worker being used for push was made redundant.",i["token-subscribe-failed"]="A problem occured while subscribing the user to FCM: {$message}",i["token-subscribe-no-token"]="FCM returned no token when subscribing the user to push.",i["token-subscribe-no-push-set"]="FCM returned an invalid response when getting an FCM token.",i["use-sw-before-get-token"]="You must call useServiceWorker() before calling getToken() to ensure your service worker is used.",i["invalid-delete-token"]="You must pass a valid token into deleteToken(), i.e. the token from getToken().",i["delete-token-not-found"]="The deletion attempt for token could not be performed as the token was not found.",i["delete-scope-not-found"]="The deletion attempt for service worker scope could not be performed as the scope was not found.",i["bg-handler-function-expected"]="The input to setBackgroundMessageHandler() must be a function.",i["no-window-client-to-msg"]="An attempt was made to message a non-existant window client.",i["unable-to-resubscribe"]="There was an error while re-subscribing the FCM token for push messaging. Will have to resubscribe the user on next visit. {$message}",i["no-fcm-token-for-resubscribe"]="Could not find an FCM token and as a result, unable to resubscribe. Will have to resubscribe the user on next visit.",i["failed-to-delete-token"]="Unable to delete the currently saved token.",i["no-sw-in-reg"]="Even though the service worker registration was successful, there was a problem accessing the service worker itself.",i["incorrect-gcm-sender-id"]="Please change your web app manifest's 'gcm_sender_id' value to '103953800507' to use Firebase messaging.",i["bad-scope"]="The service worker scope must be a string with at least one character.",i["bad-vapid-key"]="The public VAPID key must be a string with at least one character.",i["bad-subscription"]="The subscription must be a valid PushSubscription.",i["bad-token"]="The FCM Token used for storage / lookup was not a valid token string.",i["bad-push-set"]="The FCM push set used for storage / lookup was not not a valid push set string.",i["failed-delete-vapid-key"]="The VAPID key could not be deleted.",i),c={codes:s,map:a},u=function(e){return n(e).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")},_=[4,51,148,247,223,161,235,177,220,3,162,94,21,113,219,72,211,46,237,237,178,52,219,183,71,58,12,143,196,204,225,111,60,140,132,223,171,182,102,62,242,12,212,139,254,227,249,118,47,20,28,99,8,106,111,45,177,26,149,176,206,55,192,156,110],f={userVisibleOnly:!0,applicationServerKey:new Uint8Array(_)},d={ENDPOINT:"https://fcm.googleapis.com",APPLICATION_SERVER_KEY:_,SUBSCRIPTION_OPTIONS:f},h=r(10),p="fcm_token_object_Store",l=function(){function e(){this.e=new h.a("messaging","Messaging",c.map),this.t=null}return e.prototype.r=function(){return this.t?this.t:(this.t=new Promise(function(e,t){var r=indexedDB.open("fcm_token_details_db",1);r.onerror=function(e){t(e.target.error)},r.onsuccess=function(t){e(t.target.result)},r.onupgradeneeded=function(e){var t=e.target.result,r=t.createObjectStore(p,{keyPath:"swScope"});r.createIndex("fcmSenderId","fcmSenderId",{unique:!1}),r.createIndex("fcmToken","fcmToken",{unique:!0})}}),this.t)},e.prototype.closeDatabase=function(){var e=this;return this.t?this.t.then(function(t){t.close(),e.t=null}):Promise.resolve()},e.prototype.getTokenDetailsFromToken=function(e){return this.r().then(function(t){return new Promise(function(r,n){var o=t.transaction([p]),i=o.objectStore(p),s=i.index("fcmToken"),a=s.get(e);a.onerror=function(e){n(e.target.error)},a.onsuccess=function(e){r(e.target.result)}})})},e.prototype.n=function(e){return this.r().then(function(t){return new Promise(function(r,n){var o=t.transaction([p]),i=o.objectStore(p),s=i.get(e);s.onerror=function(e){n(e.target.error)},s.onsuccess=function(e){r(e.target.result)}})})},e.prototype.o=function(e){return this.r().then(function(t){return new Promise(function(r,n){var o=t.transaction([p]),i=o.objectStore(p),s=[],a=i.openCursor();a.onerror=function(e){n(e.target.error)},a.onsuccess=function(t){var n=t.target.result;n?(n.value.fcmSenderId===e&&s.push(n.value),n.continue()):r(s)}})})},e.prototype.subscribeToFCM=function(e,t,r){var n=this,o=u(t.getKey("p256dh")),i=u(t.getKey("auth")),s="authorized_entity="+e+"&endpoint="+t.endpoint+"&encryption_key="+o+"&encryption_auth="+i;r&&(s+="&pushSet="+r);var a=new Headers;a.append("Content-Type","application/x-www-form-urlencoded");var _={method:"POST",headers:a,body:s};return fetch(d.ENDPOINT+"/fcm/connect/subscribe",_).then(function(e){return e.json()}).then(function(e){var t=e;if(t.error){var r=t.error.message;throw n.e.create(c.codes.TOKEN_SUBSCRIBE_FAILED,{message:r})}if(!t.token)throw n.e.create(c.codes.TOKEN_SUBSCRIBE_NO_TOKEN);if(!t.pushSet)throw n.e.create(c.codes.TOKEN_SUBSCRIBE_NO_PUSH_SET);return{token:t.token,pushSet:t.pushSet}})},e.prototype.i=function(e,t){return e.endpoint===t.endpoint&&u(e.getKey("auth"))===t.auth&&u(e.getKey("p256dh"))===t.p256dh},e.prototype.s=function(e,t,r,n,o){var i={swScope:t.scope,endpoint:r.endpoint,auth:u(r.getKey("auth")),p256dh:u(r.getKey("p256dh")),fcmToken:n,fcmPushSet:o,fcmSenderId:e};return this.r().then(function(e){return new Promise(function(t,r){var n=e.transaction([p],"readwrite"),o=n.objectStore(p),s=o.put(i);s.onerror=function(e){r(e.target.error)},s.onsuccess=function(e){t()}})})},e.prototype.getSavedToken=function(e,t){var r=this;return t instanceof ServiceWorkerRegistration?"string"!=typeof e||0===e.length?Promise.reject(this.e.create(c.codes.BAD_SENDER_ID)):this.o(e).then(function(r){if(0!==r.length){var n=r.findIndex(function(r){return t.scope===r.swScope&&e===r.fcmSenderId});if(-1!==n)return r[n]}}).then(function(e){if(e)return t.pushManager.getSubscription().catch(function(e){throw r.e.create(c.codes.GET_SUBSCRIPTION_FAILED)}).then(function(t){if(t&&r.i(t,e))return e.fcmToken})}):Promise.reject(this.e.create(c.codes.SW_REGISTRATION_EXPECTED))},e.prototype.createToken=function(e,t){var r=this;if("string"!=typeof e||0===e.length)return Promise.reject(this.e.create(c.codes.BAD_SENDER_ID));if(!(t instanceof ServiceWorkerRegistration))return Promise.reject(this.e.create(c.codes.SW_REGISTRATION_EXPECTED));var n,o;return t.pushManager.getSubscription().then(function(e){return e||t.pushManager.subscribe(d.SUBSCRIPTION_OPTIONS)}).then(function(t){return n=t,r.subscribeToFCM(e,n)}).then(function(i){return o=i,r.s(e,t,n,o.token,o.pushSet)}).then(function(){return o.token})},e.prototype.deleteToken=function(e){var t=this;return"string"!=typeof e||0===e.length?Promise.reject(this.e.create(c.codes.INVALID_DELETE_TOKEN)):this.getTokenDetailsFromToken(e).then(function(e){if(!e)throw t.e.create(c.codes.DELETE_TOKEN_NOT_FOUND);return t.r().then(function(r){return new Promise(function(n,o){var i=r.transaction([p],"readwrite"),s=i.objectStore(p),a=s.delete(e.swScope);a.onerror=function(e){o(e.target.error)},a.onsuccess=function(r){if(0===r.target.result)return void o(t.e.create(c.codes.FAILED_TO_DELETE_TOKEN));n(e)}})})})},e}(),g=l,E=r(10),S="messagingSenderId",T=function(){function e(e){var t=this;if(this.e=new E.a("messaging","Messaging",c.map),!e.options[S]||"string"!=typeof e.options[S])throw this.e.create(c.codes.BAD_SENDER_ID);this.c=e.options[S],this.u=new g,this.app=e,this.INTERNAL={},this.INTERNAL.delete=function(){return t.delete}}return e.prototype.getToken=function(){var e=this,t=this._();return"granted"!==t?"denied"===t?Promise.reject(this.e.create(c.codes.NOTIFICATIONS_BLOCKED)):Promise.resolve(null):this.f().then(function(t){return e.u.getSavedToken(e.c,t).then(function(r){return r||e.u.createToken(e.c,t)})})},e.prototype.deleteToken=function(e){var t=this;return this.u.deleteToken(e).then(function(){return t.f().then(function(e){if(e)return e.pushManager.getSubscription()}).then(function(e){if(e)return e.unsubscribe()})})},e.prototype.f=function(){throw this.e.create(c.codes.SHOULD_BE_INHERITED)},e.prototype.requestPermission=function(){throw this.e.create(c.codes.AVAILABLE_IN_WINDOW)},e.prototype.useServiceWorker=function(e){throw this.e.create(c.codes.AVAILABLE_IN_WINDOW)},e.prototype.onMessage=function(e,t,r){throw this.e.create(c.codes.AVAILABLE_IN_WINDOW)},e.prototype.onTokenRefresh=function(e,t,r){throw this.e.create(c.codes.AVAILABLE_IN_WINDOW)},e.prototype.setBackgroundMessageHandler=function(e){throw this.e.create(c.codes.AVAILABLE_IN_SW)},e.prototype.delete=function(){this.u.closeDatabase()},e.prototype._=function(){return Notification.permission},e.prototype.getTokenManager=function(){return this.u},e}(),b=T,m={TYPE_OF_MSG:"firebase-messaging-msg-type",DATA:"firebase-messaging-msg-data"},v={PUSH_MSG_RECEIVED:"push-msg-received",NOTIFICATION_CLICKED:"notification-clicked"},I=function(e,t){return r={},r[m.TYPE_OF_MSG]=e,r[m.DATA]=t,r;var r},y={PARAMS:m,TYPES_OF_MSG:v,createNewMsg:I},N={path:"/firebase-messaging-sw.js",scope:"/firebase-cloud-messaging-push-scope"},w=r(13),k=this&&this.d||function(){var e=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])};return function(t,r){function n(){this.constructor=t}e(t,r),t.prototype=null===r?Object.create(r):(n.prototype=r.prototype,new n)}}(),O=function(e){function t(t){var r=e.call(this,t)||this;return r.h,r.p,r.l=null,r.g=Object(w.a)(function(e){r.l=e}),r.S=null,r.T=Object(w.a)(function(e){r.S=e}),r.b(),r}return k(t,e),t.prototype.getToken=function(){var t=this;return this.m()?this.v().then(function(){return e.prototype.getToken.call(t)}):Promise.reject(this.e.create(c.codes.UNSUPPORTED_BROWSER))},t.prototype.v=function(){var e=this;if(this.p)return this.p;var t=document.querySelector('link[rel="manifest"]');return this.p=t?fetch(t.href).then(function(e){return e.json()}).catch(function(){return Promise.resolve()}).then(function(t){if(t&&t.gcm_sender_id&&"103953800507"!==t.gcm_sender_id)throw e.e.create(c.codes.INCORRECT_GCM_SENDER_ID)}):Promise.resolve(),this.p},t.prototype.requestPermission=function(){var e=this;return"granted"===Notification.permission?Promise.resolve():new Promise(function(t,r){var n=function(n){return"granted"===n?t():r("denied"===n?e.e.create(c.codes.PERMISSION_BLOCKED):e.e.create(c.codes.PERMISSION_DEFAULT))},o=Notification.requestPermission(function(e){o||n(e)});o&&o.then(n)})},t.prototype.useServiceWorker=function(e){if(!(e instanceof ServiceWorkerRegistration))throw this.e.create(c.codes.SW_REGISTRATION_EXPECTED);if(void 0!==this.h)throw this.e.create(c.codes.USE_SW_BEFORE_GET_TOKEN);this.h=e},t.prototype.onMessage=function(e,t,r){return this.g(e,t,r)},t.prototype.onTokenRefresh=function(e,t,r){return this.T(e,t,r)},t.prototype.I=function(e){var t=this,r=e.installing||e.waiting||e.active;return new Promise(function(n,o){if(!r)return void o(t.e.create(c.codes.NO_SW_IN_REG));if("activated"===r.state)return void n(e);if("redundant"===r.state)return void o(t.e.create(c.codes.SW_REG_REDUNDANT));var i=function i(){if("activated"===r.state)n(e);else{if("redundant"!==r.state)return;o(t.e.create(c.codes.SW_REG_REDUNDANT))}r.removeEventListener("statechange",i)};r.addEventListener("statechange",i)})},t.prototype.f=function(){var e=this;return this.h?this.I(this.h):(this.h=null,navigator.serviceWorker.register("/firebase-messaging-sw.js",{scope:N.scope}).catch(function(t){throw e.e.create(c.codes.FAILED_DEFAULT_REGISTRATION,{browserErrorMessage:t.message})}).then(function(t){return e.I(t).then(function(){return e.h=t,t.update(),t})}))},t.prototype.b=function(){var e=this;"serviceWorker"in navigator&&navigator.serviceWorker.addEventListener("message",function(t){if(t.data&&t.data[y.PARAMS.TYPE_OF_MSG]){var r=t.data;switch(r[y.PARAMS.TYPE_OF_MSG]){case y.TYPES_OF_MSG.PUSH_MSG_RECEIVED:case y.TYPES_OF_MSG.NOTIFICATION_CLICKED:var n=r[y.PARAMS.DATA];e.l.next(n)}}},!1)},t.prototype.m=function(){return"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")},t}(b),D=O,A="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},P=this&&this.d||function(){var e=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])};return function(t,r){function n(){this.constructor=t}e(t,r),t.prototype=null===r?Object.create(r):(n.prototype=r.prototype,new n)}}(),R=function(e){function t(t){var r=e.call(this,t)||this;return self.addEventListener("push",function(e){return r.y(e)},!1),self.addEventListener("pushsubscriptionchange",function(e){return r.N(e)},!1),self.addEventListener("notificationclick",function(e){return r.w(e)},!1),r.k=null,r}return P(t,e),t.prototype.y=function(e){var t,r=this;try{t=e.data.json()}catch(e){return}var n=this.O().then(function(e){if(e){if(t.notification||r.k)return r.D(t)}else{var n=r.A(t);if(n){var o=n.title||"";return self.registration.showNotification(o,n)}if(r.k)return r.k(t)}});e.waitUntil(n)},t.prototype.N=function(e){var t=this,r=this.getToken().then(function(e){if(!e)throw t.e.create(c.codes.NO_FCM_TOKEN_FOR_RESUBSCRIBE);var r=null,n=t.getTokenManager();return n.getTokenDetailsFromToken(e).then(function(e){if(!(r=e))throw t.e.create(c.codes.INVALID_SAVED_TOKEN);return self.registration.pushManager.subscribe(d.SUBSCRIPTION_OPTIONS)}).then(function(e){return n.subscribeToFCM(r.fcmSenderId,e,r.fcmPushSet)}).catch(function(e){return n.deleteToken(r.fcmToken).then(function(){throw t.e.create(c.codes.UNABLE_TO_RESUBSCRIBE,{message:e})})})});e.waitUntil(r)},t.prototype.w=function(e){var t=this;if(e.notification&&e.notification.data&&e.notification.data.FCM_MSG){e.stopImmediatePropagation(),e.notification.close();var r=e.notification.data.FCM_MSG,n=r.notification.click_action;if(n){var o=this.P(n).then(function(e){return e||self.clients.openWindow(n)}).then(function(e){if(e){r.notification,delete r.notification;var n=y.createNewMsg(y.TYPES_OF_MSG.NOTIFICATION_CLICKED,r);return t.R(e,n)}});e.waitUntil(o)}}},t.prototype.A=function(e){if(e&&"object"===A(e.notification)){var t=Object.assign({},e.notification);return t.data=(r={},r.FCM_MSG=e,r),t;var r}},t.prototype.setBackgroundMessageHandler=function(e){if(e&&"function"!=typeof e)throw this.e.create(c.codes.BG_HANDLER_FUNCTION_EXPECTED);this.k=e},t.prototype.P=function(e){var t=new URL(e).href;return self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(function(e){for(var r=null,n=0;n<e.length;n++)if(new URL(e[n].url).href===t){r=e[n];break}if(r)return r.focus(),r})},t.prototype.R=function(e,t){var r=this;return new Promise(function(n,o){if(!e)return o(r.e.create(c.codes.NO_WINDOW_CLIENT_TO_MSG));e.postMessage(t),n()})},t.prototype.O=function(){return self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(function(e){return e.some(function(e){return"visible"===e.visibilityState})})},t.prototype.D=function(e){var t=this;return self.clients.matchAll({type:"window",includeUncontrolled:!0}).then(function(r){var n=y.createNewMsg(y.TYPES_OF_MSG.PUSH_MSG_RECEIVED,e);return Promise.all(r.map(function(e){return t.R(e,n)}))})},t.prototype.f=function(){return Promise.resolve(self.registration)},t}(b),F=R;t.registerMessaging=o,o(r(5).default)}},[24])}catch(e){throw Error("Cannot instantiate firebase-messaging.js - be sure to load firebase-app.js first.")}

try{webpackJsonpFirebase([1],{23:function(t,e,n){"use strict";function r(t){return"storage/"+t}function o(){return new $t(te.UNKNOWN,"An unknown error occurred, please check the error payload for server response.")}function i(t){return new $t(te.OBJECT_NOT_FOUND,"Object '"+t+"' does not exist.")}function a(t){return new $t(te.QUOTA_EXCEEDED,"Quota for bucket '"+t+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function u(){return new $t(te.UNAUTHENTICATED,"User is not authenticated, please authenticate using Firebase Authentication and try again.")}function s(t){return new $t(te.UNAUTHORIZED,"User does not have permission to access '"+t+"'.")}function c(){return new $t(te.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function l(){return new $t(te.CANCELED,"User canceled the upload/download.")}function p(t){return new $t(te.INVALID_URL,"Invalid URL '"+t+"'.")}function h(t){return new $t(te.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+t+"'.")}function f(){return new $t(te.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function d(){return new $t(te.SERVER_FILE_WRONG_SIZE,"Server recorded incorrect upload file size, please retry the upload.")}function _(){return new $t(te.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function v(t,e,n){return new $t(te.INVALID_ARGUMENT,"Invalid argument in `"+e+"` at index "+t+": "+n)}function b(t,e,n,r){var o,i;return t===e?(o=t,i=1===t?"argument":"arguments"):(o="between "+t+" and "+e,i="arguments"),new $t(te.INVALID_ARGUMENT_COUNT,"Invalid argument count in `"+n+"`: Expected "+o+" "+i+", received "+r+".")}function m(){return new $t(te.APP_DELETED,"The Firebase app was deleted.")}function y(t){return new $t(te.INVALID_ROOT_OPERATION,"The operation '"+t+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function g(t,e){return new $t(te.INVALID_FORMAT,"String does not match format '"+t+"': "+e)}function R(t){throw new $t(te.INTERNAL_ERROR,"Internal error: "+t)}function E(t){switch(t){case ee.RAW:case ee.BASE64:case ee.BASE64URL:case ee.DATA_URL:return;default:throw"Expected one of the event types: ["+ee.RAW+", "+ee.BASE64+", "+ee.BASE64URL+", "+ee.DATA_URL+"]."}}function w(t,e){switch(t){case ee.RAW:return new ne(U(e));case ee.BASE64:case ee.BASE64URL:return new ne(A(t,e));case ee.DATA_URL:return new ne(N(e),O(e))}throw o()}function U(t){for(var e=[],n=0;n<t.length;n++){var r=t.charCodeAt(n);if(r<=127)e.push(r);else if(r<=2047)e.push(192|r>>6,128|63&r);else if(55296==(64512&r)){var o=n<t.length-1&&56320==(64512&t.charCodeAt(n+1));if(o){var i=r,a=t.charCodeAt(++n);r=65536|(1023&i)<<10|1023&a,e.push(240|r>>18,128|r>>12&63,128|r>>6&63,128|63&r)}else e.push(239,191,189)}else 56320==(64512&r)?e.push(239,191,189):e.push(224|r>>12,128|r>>6&63,128|63&r)}return new Uint8Array(e)}function T(t){var e;try{e=decodeURIComponent(t)}catch(t){throw g(ee.DATA_URL,"Malformed data URL.")}return U(e)}function A(t,e){switch(t){case ee.BASE64:var n=-1!==e.indexOf("-"),r=-1!==e.indexOf("_");if(n||r){var o=n?"-":"_";throw g(t,"Invalid character '"+o+"' found: is it base64url encoded?")}break;case ee.BASE64URL:var i=-1!==e.indexOf("+"),a=-1!==e.indexOf("/");if(i||a){var o=i?"+":"/";throw g(t,"Invalid character '"+o+"' found: is it base64 encoded?")}e=e.replace(/-/g,"+").replace(/_/g,"/")}var u;try{u=atob(e)}catch(e){throw g(t,"Invalid character found")}for(var s=new Uint8Array(u.length),c=0;c<u.length;c++)s[c]=u.charCodeAt(c);return s}function N(t){var e=new re(t);return e.base64?A(ee.BASE64,e.rest):T(e.rest)}function O(t){return new re(t).contentType}function C(t,e){return!!(t.length>=e.length)&&t.substring(t.length-e.length)===e}function S(t){switch(t){case ie.RUNNING:case ie.PAUSING:case ie.CANCELING:return ae.RUNNING;case ie.PAUSED:return ae.PAUSED;case ie.SUCCESS:return ae.SUCCESS;case ie.CANCELED:return ae.CANCELED;case ie.ERROR:default:return ae.ERROR}}function k(t,e){return Object.prototype.hasOwnProperty.call(t,e)}function I(t,e){for(var n in t)k(t,n)&&e(n,t[n])}function L(t){if(null==t)return{};var e={};return I(t,function(t,n){e[t]=n}),e}function x(t){return new ue.b(t)}function P(t){return ue.b.resolve(t)}function D(t){return ue.b.reject(t)}function M(t){return null!=t}function W(t){return void 0!==t}function B(t){return"function"==typeof t}function G(t){return"object"===(void 0===t?"undefined":se(t))}function j(t){return G(t)&&null!==t}function q(t){return G(t)&&!Array.isArray(t)}function F(t){return"string"==typeof t||t instanceof String}function H(t){return"number"==typeof t||t instanceof Number}function z(t){return X()&&t instanceof Blob}function X(){return"undefined"!=typeof Blob}function V(t){var e;try{e=JSON.parse(t)}catch(t){return null}return q(e)?e:null}function K(t){if(0==t.length)return null;var e=t.lastIndexOf("/");return-1===e?"":t.slice(0,e)}function Z(t,e){var n=e.split("/").filter(function(t){return t.length>0}).join("/");return 0===t.length?n:t+"/"+n}function J(t){var e=t.lastIndexOf("/",t.length-2);return-1===e?t:t.slice(e+1)}function Q(t){return Xt+Kt+t}function Y(t){return Vt+Kt+t}function $(t){return Xt+Zt+t}function tt(t){var e=encodeURIComponent,n="?";return I(t,function(t,r){var o=e(t)+"="+e(r);n=n+o+"&"}),n=n.slice(0,-1)}function et(t,e){return e}function nt(t){return!F(t)||t.length<2?t:(t=t,J(t))}function rt(){function t(t,e){return nt(e)}function e(t,e){return M(e)?+e:e}function n(t,e){if(!(F(e)&&e.length>0))return[];var n=encodeURIComponent;return e.split(",").map(function(e){var r=t.bucket,o=t.fullPath;return Y("/b/"+n(r)+"/o/"+n(o))+tt({alt:"media",token:e})})}if(fe)return fe;var r=[];r.push(new he("bucket")),r.push(new he("generation")),r.push(new he("metageneration")),r.push(new he("name","fullPath",!0));var o=new he("name");o.xform=t,r.push(o);var i=new he("size");return i.xform=e,r.push(i),r.push(new he("timeCreated")),r.push(new he("updated")),r.push(new he("md5Hash",null,!0)),r.push(new he("cacheControl",null,!0)),r.push(new he("contentDisposition",null,!0)),r.push(new he("contentEncoding",null,!0)),r.push(new he("contentLanguage",null,!0)),r.push(new he("contentType",null,!0)),r.push(new he("metadata","customMetadata",!0)),r.push(new he("downloadTokens","downloadURLs",!1,n)),fe=r}function ot(t,e){function n(){var n=t.bucket,r=t.fullPath,o=new pe(n,r);return e.makeStorageReference(o)}Object.defineProperty(t,"ref",{get:n})}function it(t,e,n){var r={};r.type="file";for(var o=n.length,i=0;i<o;i++){var a=n[i];r[a.local]=a.xform(r,e[a.server])}return ot(r,t),r}function at(t,e,n){var r=V(e);return null===r?null:it(t,r,n)}function ut(t,e){for(var n={},r=e.length,o=0;o<r;o++){var i=e[o];i.writable&&(n[i.server]=t[i.local])}return JSON.stringify(n)}function st(t){if(!t||!G(t))throw"Expected Metadata object.";for(var e in t){var n=t[e];if("customMetadata"===e){if(!G(n))throw"Expected object for 'customMetadata' mapping."}else if(j(n))throw"Mapping for '"+e+"' cannot be an object."}}function ct(t,e,n){for(var r=e.length,o=e.length,i=0;i<e.length;i++)if(e[i].optional){r=i;break}if(!(r<=n.length&&n.length<=o))throw b(r,o,t,n.length);for(var i=0;i<n.length;i++)try{e[i].validator(n[i])}catch(e){throw e instanceof Error?v(i,t,e.message):v(i,t,e)}}function lt(t,e){return function(n){t(n),e(n)}}function pt(t,e){function n(t){if(!F(t))throw"Expected string."}var r;return r=t?lt(n,t):n,new de(r,e)}function ht(){function t(t){if(!(t instanceof Uint8Array||t instanceof ArrayBuffer||X()&&t instanceof Blob))throw"Expected Blob or File."}return new de(t)}function ft(t){return new de(st,t)}function dt(){function t(t){if(!(H(t)&&t>=0))throw"Expected a number 0 or greater."}return new de(t)}function _t(t,e){function n(e){if(!(null===e||M(e)&&e instanceof Object))throw"Expected an Object.";void 0!==t&&null!==t&&t(e)}return new de(n,e)}function vt(t){function e(t){if(null!==t&&!B(t))throw"Expected a Function."}return new de(e,t)}function bt(){return"undefined"!=typeof BlobBuilder?BlobBuilder:"undefined"!=typeof WebKitBlobBuilder?WebKitBlobBuilder:void 0}function mt(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var n=bt();if(void 0!==n){for(var r=new n,o=0;o<t.length;o++)r.append(t[o]);return r.getBlob()}if(X())return new Blob(t);throw Error("This browser doesn't seem to support creating Blobs")}function yt(t,e,n){return t.webkitSlice?t.webkitSlice(e,n):t.mozSlice?t.mozSlice(e,n):t.slice?t.slice(e,n):null}function gt(t,e){return-1!==t.indexOf(e)}function Rt(t){return Array.prototype.slice.call(t)}function Et(t,e){var n=t.indexOf(e);-1!==n&&t.splice(n,1)}function wt(t){if(!t)throw o()}function Ut(t,e){function n(n,r){var o=at(t,r,e);return wt(null!==o),o}return n}function Tt(t){function e(e,n){var r;return r=401===e.getStatus()?u():402===e.getStatus()?a(t.bucket):403===e.getStatus()?s(t.path):n,r.setServerResponseProp(n.serverResponseProp()),r}return e}function At(t){function e(e,r){var o=n(e,r);return 404===e.getStatus()&&(o=i(t.path)),o.setServerResponseProp(r.serverResponseProp()),o}var n=Tt(t);return e}function Nt(t,e,n){var r=e.fullServerUrl(),o=Q(r),i=t.maxOperationRetryTime(),a=new ve(o,"GET",Ut(t,n),i);return a.errorHandler=At(e),a}function Ot(t,e,n,r){var o=e.fullServerUrl(),i=Q(o),a=ut(n,r),u={"Content-Type":"application/json; charset=utf-8"},s=t.maxOperationRetryTime(),c=new ve(i,"PATCH",Ut(t,r),s);return c.headers=u,c.body=a,c.errorHandler=At(e),c}function Ct(t,e){function n(t,e){}var r=e.fullServerUrl(),o=Q(r),i=t.maxOperationRetryTime(),a=new ve(o,"DELETE",n,i);return a.successCodes=[200,204],a.errorHandler=At(e),a}function St(t,e){return t&&t.contentType||e&&e.type()||"application/octet-stream"}function kt(t,e,n){var r=L(n);return r.fullPath=t.path,r.size=e.size(),r.contentType||(r.contentType=St(null,e)),r}function It(t,e,n,r,o){var i=e.bucketOnlyServerUrl(),a={"X-Goog-Upload-Protocol":"multipart"},u=function(){for(var t="",e=0;e<2;e++)t+=(""+Math.random()).slice(2);return t}();a["Content-Type"]="multipart/related; boundary="+u;var s=kt(e,r,o),c=ut(s,n),l="--"+u+"\r\nContent-Type: application/json; charset=utf-8\r\n\r\n"+c+"\r\n--"+u+"\r\nContent-Type: "+s.contentType+"\r\n\r\n",p="\r\n--"+u+"--",h=_e.getBlob(l,r,p);if(null===h)throw f();var d={name:s.fullPath},_=$(i),v=t.maxUploadRetryTime(),b=new ve(_,"POST",Ut(t,n),v);return b.urlParams=d,b.headers=a,b.body=h.uploadData(),b.errorHandler=Tt(e),b}function Lt(t,e){var n;try{n=t.getResponseHeader("X-Goog-Upload-Status")}catch(t){wt(!1)}return wt(gt(e||["active"],n)),n}function xt(t,e,n,r,o){function i(t,e){Lt(t);var n;try{n=t.getResponseHeader("X-Goog-Upload-URL")}catch(t){wt(!1)}return wt(F(n)),n}var a=e.bucketOnlyServerUrl(),u=kt(e,r,o),s={name:u.fullPath},c=$(a),l={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":r.size(),"X-Goog-Upload-Header-Content-Type":u.contentType,"Content-Type":"application/json; charset=utf-8"},p=ut(u,n),h=t.maxUploadRetryTime(),f=new ve(c,"POST",i,h);return f.urlParams=s,f.headers=l,f.body=p,f.errorHandler=Tt(e),f}function Pt(t,e,n,r){function o(t,e){var n,o=Lt(t,["active","final"]);try{n=t.getResponseHeader("X-Goog-Upload-Size-Received")}catch(t){wt(!1)}var i=parseInt(n,10);return wt(!isNaN(i)),new be(i,r.size(),"final"===o)}var i={"X-Goog-Upload-Command":"query"},a=t.maxUploadRetryTime(),u=new ve(n,"POST",o,a);return u.headers=i,u.errorHandler=Tt(e),u}function Dt(t,e,n,r,o,i,a,u){function s(t,n){var o,a=Lt(t,["active","final"]),u=c.current+p,s=r.size();return o="final"===a?Ut(e,i)(t,n):null,new be(u,s,"final"===a,o)}var c=new be(0,0);if(a?(c.current=a.current,c.total=a.total):(c.current=0,c.total=r.size()),r.size()!==c.total)throw d();var l=c.total-c.current,p=l;o>0&&(p=Math.min(p,o));var h=c.current,_=h+p,v=p===l?"upload, finalize":"upload",b={"X-Goog-Upload-Command":v,"X-Goog-Upload-Offset":c.current},m=r.slice(h,_);if(null===m)throw f();var y=e.maxUploadRetryTime(),g=new ve(n,"POST",s,y);return g.headers=b,g.body=m.uploadData(),g.progressCallback=u||null,g.errorHandler=Tt(t),g}function Mt(t){return function(){for(var e=[],n=0;n<arguments.length;n++)e[n]=arguments[n];P(!0).then(function(){t.apply(null,e)})}}function Wt(t,e,n){function r(){return 2===p}function o(){h||(h=!0,e.apply(null,arguments))}function i(e){c=setTimeout(function(){c=null,t(a,r())},e)}function a(t){for(var e=[],n=1;n<arguments.length;n++)e[n-1]=arguments[n];if(!h){if(t)return void o.apply(null,arguments);if(r()||l)return void o.apply(null,arguments);s<64&&(s*=2);var a;1===p?(p=2,a=0):a=1e3*(s+Math.random()),i(a)}}function u(t){f||(f=!0,h||(null!==c?(t||(p=2),clearTimeout(c),i(0)):t||(p=1)))}var s=1,c=null,l=!1,p=0,h=!1,f=!1;return i(0),setTimeout(function(){l=!0,u(!0)},n),u}function Bt(t){t(!1)}function Gt(t,e){null!==e&&e.length>0&&(t.Authorization="Firebase "+e)}function jt(t){var e="undefined"!=typeof firebase?firebase.SDK_VERSION:"AppManager";t["X-Firebase-Storage-Version"]="webjs/"+e}function qt(t,e,n){var r=tt(t.urlParams),o=t.url+r,i=L(t.headers);return Gt(i,e),jt(i),new Te(o,t.method,i,t.body,t.successCodes,t.additionalRetryCodes,t.handler,t.errorHandler,t.timeout,t.progressCallback,n)}function Ft(t,e,n){return new Ne(t,new le,n)}function Ht(t){var e={TaskState:ae,TaskEvent:oe,StringFormat:ee,Storage:Ne,Reference:Re};t.INTERNAL.registerService(Ce,Ft,e,void 0,!0)}Object.defineProperty(e,"__esModule",{value:!0});var zt,Xt="https://firebasestorage.googleapis.com",Vt="https://firebasestorage.googleapis.com",Kt="/v0",Zt="/v0",Jt=12e4,Qt=6e4,Yt=-9007199254740991,$t=function(){function t(t,e){this.t=r(t),this.e="Firebase Storage: "+e,this.n=null,this.r="FirebaseError"}return t.prototype.codeProp=function(){return this.code},t.prototype.codeEquals=function(t){return r(t)===this.codeProp()},t.prototype.serverResponseProp=function(){return this.n},t.prototype.setServerResponseProp=function(t){this.n=t},Object.defineProperty(t.prototype,"name",{get:function(){return this.r},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"code",{get:function(){return this.t},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"message",{get:function(){return this.e},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"serverResponse",{get:function(){return this.n},enumerable:!0,configurable:!0}),t}(),te={UNKNOWN:"unknown",OBJECT_NOT_FOUND:"object-not-found",BUCKET_NOT_FOUND:"bucket-not-found",PROJECT_NOT_FOUND:"project-not-found",QUOTA_EXCEEDED:"quota-exceeded",UNAUTHENTICATED:"unauthenticated",UNAUTHORIZED:"unauthorized",RETRY_LIMIT_EXCEEDED:"retry-limit-exceeded",INVALID_CHECKSUM:"invalid-checksum",CANCELED:"canceled",INVALID_EVENT_NAME:"invalid-event-name",INVALID_URL:"invalid-url",INVALID_DEFAULT_BUCKET:"invalid-default-bucket",NO_DEFAULT_BUCKET:"no-default-bucket",CANNOT_SLICE_BLOB:"cannot-slice-blob",SERVER_FILE_WRONG_SIZE:"server-file-wrong-size",NO_DOWNLOAD_URL:"no-download-url",INVALID_ARGUMENT:"invalid-argument",INVALID_ARGUMENT_COUNT:"invalid-argument-count",APP_DELETED:"app-deleted",INVALID_ROOT_OPERATION:"invalid-root-operation",INVALID_FORMAT:"invalid-format",INTERNAL_ERROR:"internal-error"},ee={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"},ne=function(){function t(t,e){this.data=t,this.contentType=e||null}return t}(),re=function(){function t(t){this.base64=!1,this.contentType=null;var e=t.match(/^data:([^,]+)?,/);if(null===e)throw g(ee.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");var n=e[1]||null;null!=n&&(this.base64=C(n,";base64"),this.contentType=this.base64?n.substring(0,n.length-7):n),this.rest=t.substring(t.indexOf(",")+1)}return t}(),oe={STATE_CHANGED:"state_changed"},ie={RUNNING:"running",PAUSING:"pausing",PAUSED:"paused",SUCCESS:"success",CANCELING:"canceling",CANCELED:"canceled",ERROR:"error"},ae={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"},ue=n(4),se="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t};!function(t){t[t.NO_ERROR=0]="NO_ERROR",t[t.NETWORK_ERROR=1]="NETWORK_ERROR",t[t.ABORT=2]="ABORT"}(zt||(zt={}));var ce=function(){function t(){var t=this;this.o=!1,this.i=new XMLHttpRequest,this.a=zt.NO_ERROR,this.u=x(function(e,n){t.i.addEventListener("abort",function(n){t.a=zt.ABORT,e(t)}),t.i.addEventListener("error",function(n){t.a=zt.NETWORK_ERROR,e(t)}),t.i.addEventListener("load",function(n){e(t)})})}return t.prototype.send=function(t,e,n,r){var o=this;if(this.o)throw R("cannot .send() more than once");return this.o=!0,this.i.open(e,t,!0),M(r)&&I(r,function(t,e){o.i.setRequestHeader(t,""+e)}),M(n)?this.i.send(n):this.i.send(),this.u},t.prototype.getErrorCode=function(){if(!this.o)throw R("cannot .getErrorCode() before sending");return this.a},t.prototype.getStatus=function(){if(!this.o)throw R("cannot .getStatus() before sending");try{return this.i.status}catch(t){return-1}},t.prototype.getResponseText=function(){if(!this.o)throw R("cannot .getResponseText() before sending");return this.i.responseText},t.prototype.abort=function(){this.i.abort()},t.prototype.getResponseHeader=function(t){return this.i.getResponseHeader(t)},t.prototype.addUploadProgressListener=function(t){M(this.i.upload)&&this.i.upload.addEventListener("progress",t)},t.prototype.removeUploadProgressListener=function(t){M(this.i.upload)&&this.i.upload.removeEventListener("progress",t)},t}(),le=function(){function t(){}return t.prototype.createXhrIo=function(){return new ce},t}(),pe=function(){function t(t,e){this.bucket=t,this.s=e}return Object.defineProperty(t.prototype,"path",{get:function(){return this.s},enumerable:!0,configurable:!0}),t.prototype.fullServerUrl=function(){var t=encodeURIComponent;return"/b/"+t(this.bucket)+"/o/"+t(this.path)},t.prototype.bucketOnlyServerUrl=function(){return"/b/"+encodeURIComponent(this.bucket)+"/o"},t.makeFromBucketSpec=function(e){var n;try{n=t.makeFromUrl(e)}catch(n){return new t(e,"")}if(""===n.path)return n;throw h(e)},t.makeFromUrl=function(e){function n(t){"/"===t.path.charAt(t.path.length-1)&&(t.s=t.s.slice(0,-1))}function r(t){t.s=decodeURIComponent(t.path)}for(var o=null,i=RegExp("^gs://([A-Za-z0-9.\\-]+)(/(.*))?$","i"),a={bucket:1,path:3},u=RegExp("^https?://firebasestorage\\.googleapis\\.com/v[A-Za-z0-9_]+/b/([A-Za-z0-9.\\-]+)/o(/([^?#]*).*)?$","i"),s={bucket:1,path:3},c=[{regex:i,indices:a,postModify:n},{regex:u,indices:s,postModify:r}],l=0;l<c.length;l++){var h=c[l],f=h.regex.exec(e);if(f){var d=f[h.indices.bucket],_=f[h.indices.path];_||(_=""),o=new t(d,_),h.postModify(o);break}}if(null==o)throw p(e);return o},t}(),he=function(){function t(t,e,n,r){this.server=t,this.local=e||t,this.writable=!!n,this.xform=r||et}return t}(),fe=null,de=function(){function t(t,e){var n=this;this.validator=function(e){n.optional&&!W(e)||t(e)},this.optional=!!e}return t}(),_e=function(){function t(t,e){var n=0,r="";z(t)?(this.c=t,n=t.size,r=t.type):t instanceof ArrayBuffer?(e?this.c=new Uint8Array(t):(this.c=new Uint8Array(t.byteLength),this.c.set(new Uint8Array(t))),n=this.c.length):t instanceof Uint8Array&&(e?this.c=t:(this.c=new Uint8Array(t.length),this.c.set(t)),n=t.length),this.l=n,this.p=r}return t.prototype.size=function(){return this.l},t.prototype.type=function(){return this.p},t.prototype.slice=function(e,n){if(z(this.c)){var r=this.c,o=yt(r,e,n);return null===o?null:new t(o)}return new t(new Uint8Array(this.c.buffer,e,n-e),!0)},t.getBlob=function(){for(var e=[],n=0;n<arguments.length;n++)e[n]=arguments[n];if(X()){var r=e.map(function(e){return e instanceof t?e.c:e});return new t(mt.apply(null,r))}var o=e.map(function(t){return F(t)?w(ee.RAW,t).data:t.c}),i=0;o.forEach(function(t){i+=t.byteLength});var a=new Uint8Array(i),u=0;return o.forEach(function(t){for(var e=0;e<t.length;e++)a[u++]=t[e]}),new t(a,!0)},t.prototype.uploadData=function(){return this.c},t}(),ve=function(){function t(t,e,n,r){this.url=t,this.method=e,this.handler=n,this.timeout=r,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}return t}(),be=function(){function t(t,e,n,r){this.current=t,this.total=e,this.finalized=!!n,this.metadata=r||null}return t}(),me=function(){function t(t,e,n){if(B(t)||M(e)||M(n))this.next=t,this.error=e||null,this.complete=n||null;else{var r=t;this.next=r.next||null,this.error=r.error||null,this.complete=r.complete||null}}return t}(),ye=function(){function t(t,e,n,r,o,i){this.bytesTransferred=t,this.totalBytes=e,this.state=n,this.metadata=r,this.task=o,this.ref=i}return Object.defineProperty(t.prototype,"downloadURL",{get:function(){if(null!==this.metadata){var t=this.metadata.downloadURLs;return null!=t&&null!=t[0]?t[0]:null}return null},enumerable:!0,configurable:!0}),t}(),ge=function(){function t(t,e,n,r,o,i){void 0===i&&(i=null);var a=this;this.h=0,this.f=!1,this.d=!1,this._=[],this.v=null,this.m=null,this.y=null,this.g=1,this.R=null,this.w=null,this.U=t,this.T=e,this.A=n,this.N=o,this.O=i,this.C=r,this.S=this.k(this.N),this.I=ie.RUNNING,this.L=function(t){a.y=null,a.g=1,t.codeEquals(te.CANCELED)?(a.f=!0,a.x()):(a.v=t,a.P(ie.ERROR))},this.D=function(t){a.y=null,t.codeEquals(te.CANCELED)?a.x():(a.v=t,a.P(ie.ERROR))},this.M=x(function(t,e){a.R=t,a.w=e,a.W()}),this.M.then(null,function(){})}return t.prototype.B=function(){var t=this,e=this.h;return function(n,r){t.G(e+n)}},t.prototype.k=function(t){return t.size()>262144},t.prototype.W=function(){this.I===ie.RUNNING&&null===this.y&&(this.S?null===this.m?this.j():this.f?this.q():this.d?this.F():this.H():this.z())},t.prototype.X=function(t){var e=this;this.T.getAuthToken().then(function(n){switch(e.I){case ie.RUNNING:t(n);break;case ie.CANCELING:e.P(ie.CANCELED);break;case ie.PAUSING:e.P(ie.PAUSED)}})},t.prototype.j=function(){var t=this;this.X(function(e){var n=xt(t.T,t.A,t.C,t.N,t.O),r=t.T.makeRequest(n,e);t.y=r,r.getPromise().then(function(e){t.y=null,t.m=e,t.f=!1,t.x()},t.L)})},t.prototype.q=function(){var t=this,e=this.m;this.X(function(n){var r=Pt(t.T,t.A,e,t.N),o=t.T.makeRequest(r,n);t.y=o,o.getPromise().then(function(e){e=e,t.y=null,t.G(e.current),t.f=!1,e.finalized&&(t.d=!0),t.x()},t.L)})},t.prototype.H=function(){var t=this,e=262144*this.g,n=new be(this.h,this.N.size()),r=this.m;this.X(function(o){var i;try{i=Dt(t.A,t.T,r,t.N,e,t.C,n,t.B())}catch(e){return t.v=e,void t.P(ie.ERROR)}var a=t.T.makeRequest(i,o);t.y=a,a.getPromise().then(function(e){t.V(),t.y=null,t.G(e.current),e.finalized?(t.O=e.metadata,t.P(ie.SUCCESS)):t.x()},t.L)})},t.prototype.V=function(){262144*this.g<33554432&&(this.g*=2)},t.prototype.F=function(){var t=this;this.X(function(e){var n=Nt(t.T,t.A,t.C),r=t.T.makeRequest(n,e);t.y=r,r.getPromise().then(function(e){t.y=null,t.O=e,t.P(ie.SUCCESS)},t.D)})},t.prototype.z=function(){var t=this;this.X(function(e){var n=It(t.T,t.A,t.C,t.N,t.O),r=t.T.makeRequest(n,e);t.y=r,r.getPromise().then(function(e){t.y=null,t.O=e,t.G(t.N.size()),t.P(ie.SUCCESS)},t.L)})},t.prototype.G=function(t){var e=this.h;this.h=t,this.h!==e&&this.K()},t.prototype.P=function(t){if(this.I!==t)switch(t){case ie.CANCELING:case ie.PAUSING:this.I=t,null!==this.y&&this.y.cancel();break;case ie.RUNNING:var e=this.I===ie.PAUSED;this.I=t,e&&(this.K(),this.W());break;case ie.PAUSED:this.I=t,this.K();break;case ie.CANCELED:this.v=l(),this.I=t,this.K();break;case ie.ERROR:case ie.SUCCESS:this.I=t,this.K()}},t.prototype.x=function(){switch(this.I){case ie.PAUSING:this.P(ie.PAUSED);break;case ie.CANCELING:this.P(ie.CANCELED);break;case ie.RUNNING:this.W()}},Object.defineProperty(t.prototype,"snapshot",{get:function(){var t=S(this.I);return new ye(this.h,this.N.size(),t,this.O,this,this.U)},enumerable:!0,configurable:!0}),t.prototype.on=function(t,e,n,r){function o(e){if(t!==oe.STATE_CHANGED)throw"Expected one of the event types: ["+oe.STATE_CHANGED+"]."}function i(t){try{return void c(t)}catch(t){}try{if(l(t),!(W(t.next)||W(t.error)||W(t.complete)))throw"";return}catch(t){throw s}}function a(t){function e(e,n,o){null!==t&&ct("on",t,arguments);var i=new me(e,n,r);return p.Z(i),function(){p.J(i)}}return e}function u(t){if(null===t)throw s;i(t)}void 0===e&&(e=void 0),void 0===n&&(n=void 0),void 0===r&&(r=void 0);var s="Expected a function or an Object with one of `next`, `error`, `complete` properties.",c=vt(!0).validator,l=_t(null,!0).validator;ct("on",[pt(o),_t(i,!0),vt(!0),vt(!0)],arguments);var p=this,h=[_t(u),vt(!0),vt(!0)];return W(e)||W(n)||W(r)?a(null)(e,n,r):a(h)},t.prototype.then=function(t,e){return this.M.then(t,e)},t.prototype.catch=function(t){return this.then(null,t)},t.prototype.Z=function(t){this._.push(t),this.Q(t)},t.prototype.J=function(t){Et(this._,t)},t.prototype.K=function(){var t=this;this.Y(),Rt(this._).forEach(function(e){t.Q(e)})},t.prototype.Y=function(){if(null!==this.R){var t=!0;switch(S(this.I)){case ae.SUCCESS:Mt(this.R.bind(null,this.snapshot))();break;case ae.CANCELED:case ae.ERROR:Mt(this.w.bind(null,this.v))();break;default:t=!1}t&&(this.R=null,this.w=null)}},t.prototype.Q=function(t){switch(S(this.I)){case ae.RUNNING:case ae.PAUSED:null!==t.next&&Mt(t.next.bind(t,this.snapshot))();break;case ae.SUCCESS:null!==t.complete&&Mt(t.complete.bind(t))();break;case ae.CANCELED:case ae.ERROR:null!==t.error&&Mt(t.error.bind(t,this.v))();break;default:null!==t.error&&Mt(t.error.bind(t,this.v))()}},t.prototype.resume=function(){ct("resume",[],arguments);var t=this.I===ie.PAUSED||this.I===ie.PAUSING;return t&&this.P(ie.RUNNING),t},t.prototype.pause=function(){ct("pause",[],arguments);var t=this.I===ie.RUNNING;return t&&this.P(ie.PAUSING),t},t.prototype.cancel=function(){ct("cancel",[],arguments);var t=this.I===ie.RUNNING||this.I===ie.PAUSING;return t&&this.P(ie.CANCELING),t},t}(),Re=function(){function t(t,e){this.authWrapper=t,this.location=e instanceof pe?e:pe.makeFromUrl(e)}return t.prototype.toString=function(){return ct("toString",[],arguments),"gs://"+this.location.bucket+"/"+this.location.path},t.prototype.newRef=function(e,n){return new t(e,n)},t.prototype.mappings=function(){return rt()},t.prototype.child=function(t){ct("child",[pt()],arguments);var e=Z(this.location.path,t),n=new pe(this.location.bucket,e);return this.newRef(this.authWrapper,n)},Object.defineProperty(t.prototype,"parent",{get:function(){var t=K(this.location.path);if(null===t)return null;var e=new pe(this.location.bucket,t);return this.newRef(this.authWrapper,e)},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"root",{get:function(){var t=new pe(this.location.bucket,"");return this.newRef(this.authWrapper,t)},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"bucket",{get:function(){return this.location.bucket},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"fullPath",{get:function(){return this.location.path},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"name",{get:function(){return J(this.location.path)},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"storage",{get:function(){return this.authWrapper.service()},enumerable:!0,configurable:!0}),t.prototype.put=function(t,e){return void 0===e&&(e=null),ct("put",[ht(),ft(!0)],arguments),this.$("put"),new ge(this,this.authWrapper,this.location,this.mappings(),new _e(t),e)},t.prototype.putString=function(t,e,n){void 0===e&&(e=ee.RAW),ct("putString",[pt(),pt(E,!0),ft(!0)],arguments),this.$("putString");var r=w(e,t),o=L(n);return!M(o.contentType)&&M(r.contentType)&&(o.contentType=r.contentType),new ge(this,this.authWrapper,this.location,this.mappings(),new _e(r.data,!0),o)},t.prototype.delete=function(){ct("delete",[],arguments),this.$("delete");var t=this;return this.authWrapper.getAuthToken().then(function(e){var n=Ct(t.authWrapper,t.location);return t.authWrapper.makeRequest(n,e).getPromise()})},t.prototype.getMetadata=function(){ct("getMetadata",[],arguments),this.$("getMetadata");var t=this;return this.authWrapper.getAuthToken().then(function(e){var n=Nt(t.authWrapper,t.location,t.mappings());return t.authWrapper.makeRequest(n,e).getPromise()})},t.prototype.updateMetadata=function(t){ct("updateMetadata",[ft()],arguments),this.$("updateMetadata");var e=this;return this.authWrapper.getAuthToken().then(function(n){var r=Ot(e.authWrapper,e.location,t,e.mappings());return e.authWrapper.makeRequest(r,n).getPromise()})},t.prototype.getDownloadURL=function(){return ct("getDownloadURL",[],arguments),this.$("getDownloadURL"),this.getMetadata().then(function(t){var e=t.downloadURLs[0];if(M(e))return e;throw _()})},t.prototype.$=function(t){if(""===this.location.path)throw y(t)},t}(),Ee=function(){function t(t){this.M=D(t)}return t.prototype.getPromise=function(){return this.M},t.prototype.cancel=function(t){void 0===t&&(t=!1)},t}(),we=function(){function t(){this.tt={},this.et=Yt}return t.prototype.addRequest=function(t){function e(){delete r.tt[n]}var n=this.et;this.et++,this.tt[n]=t;var r=this;t.getPromise().then(e,e)},t.prototype.clear=function(){I(this.tt,function(t,e){e&&e.cancel(!0)}),this.tt={}},t}(),Ue=function(){function t(e,n,r,o,i){if(this.nt=null,this.rt=!1,this.ot=e,null!==this.ot){var a=this.ot.options;M(a)&&(this.nt=t.it(a))}this.ut=n,this.st=r,this.ct=i,this.lt=o,this.pt=Jt,this.ht=Qt,this.ft=new we}return t.it=function(t){var e=t.storageBucket||null;return null==e?null:pe.makeFromBucketSpec(e).bucket},t.prototype.getAuthToken=function(){return null!==this.ot&&M(this.ot.INTERNAL)&&M(this.ot.INTERNAL.getToken)?this.ot.INTERNAL.getToken().then(function(t){return null!==t?t.accessToken:null},function(t){return null}):P(null)},t.prototype.bucket=function(){if(this.rt)throw m();return this.nt},t.prototype.service=function(){return this.lt},t.prototype.makeStorageReference=function(t){return this.ut(this,t)},t.prototype.makeRequest=function(t,e){if(this.rt)return new Ee(m());var n=this.st(t,e,this.ct);return this.ft.addRequest(n),n},t.prototype.deleteApp=function(){this.rt=!0,this.ot=null,this.ft.clear()},t.prototype.maxUploadRetryTime=function(){return this.ht},t.prototype.setMaxUploadRetryTime=function(t){this.ht=t},t.prototype.maxOperationRetryTime=function(){return this.pt},t.prototype.setMaxOperationRetryTime=function(t){this.pt=t},t}(),Te=function(){function t(t,e,n,r,o,i,a,u,s,c,l){this.dt=null,this._t=null,this.R=null,this.w=null,this.vt=!1,this.bt=!1,this.mt=t,this.yt=e,this.gt=n,this.Rt=r,this.Et=o.slice(),this.wt=i.slice(),this.Ut=a,this.Tt=u,this.At=c,this.Nt=s,this.ct=l;var p=this;this.M=x(function(t,e){p.R=t,p.w=e,p.W()})}return t.prototype.W=function(){function t(t,e){function r(t){var e=t.loaded,r=t.lengthComputable?t.total:-1;null!==n.At&&n.At(e,r)}if(e)return void t(!1,new Ae(!1,null,!0));var o=n.ct.createXhrIo();n.dt=o,null!==n.At&&o.addUploadProgressListener(r),o.send(n.mt,n.yt,n.Rt,n.gt).then(function(e){null!==n.At&&e.removeUploadProgressListener(r),n.dt=null,e=e;var o=e.getErrorCode()===zt.NO_ERROR,i=e.getStatus();if(!o||n.Ot(i)){var a=e.getErrorCode()===zt.ABORT;return void t(!1,new Ae(!1,null,a))}var u=gt(n.Et,i);t(!0,new Ae(u,e))})}function e(t,e){var r=n.R,i=n.w,a=e.xhr;if(e.wasSuccessCode)try{var u=n.Ut(a,a.getResponseText());W(u)?r(u):r()}catch(t){i(t)}else if(null!==a){var s=o();s.setServerResponseProp(a.getResponseText()),i(n.Tt?n.Tt(a,s):s)}else if(e.canceled){var s=n.bt?m():l();i(s)}else{var s=c();i(s)}}var n=this;this.vt?e(!1,new Ae(!1,null,!0)):this._t=Wt(t,e,this.Nt)},t.prototype.getPromise=function(){return this.M},t.prototype.cancel=function(t){this.vt=!0,this.bt=t||!1,null!==this._t&&Bt(this._t),null!==this.dt&&this.dt.abort()},t.prototype.Ot=function(t){var e=t>=500&&t<600,n=[408,429],r=gt(n,t),o=gt(this.wt,t);return e||r||o},t}(),Ae=function(){function t(t,e,n){this.wasSuccessCode=t,this.xhr=e,this.canceled=!!n}return t}(),Ne=function(){function t(t,e,n){function r(t,e){return new Re(t,e)}if(this.nt=null,this.T=new Ue(t,r,qt,this,e),this.ot=t,null!=n)this.nt=pe.makeFromBucketSpec(n);else{var o=this.T.bucket();null!=o&&(this.nt=new pe(o,""))}this.Ct=new Oe(this)}return t.prototype.ref=function(t){function e(t){if(/^[A-Za-z]+:\/\//.test(t))throw"Expected child path but got a URL, use refFromURL instead."}if(ct("ref",[pt(e,!0)],arguments),null==this.nt)throw Error("No Storage Bucket defined in Firebase Options.");var n=new Re(this.T,this.nt);return null!=t?n.child(t):n},t.prototype.refFromURL=function(t){function e(t){if(!/^[A-Za-z]+:\/\//.test(t))throw"Expected full URL but got a child path, use ref instead.";try{pe.makeFromUrl(t)}catch(t){throw"Expected valid full URL but got an invalid one."}}return ct("refFromURL",[pt(e,!1)],arguments),new Re(this.T,t)},Object.defineProperty(t.prototype,"maxUploadRetryTime",{get:function(){return this.T.maxUploadRetryTime()},enumerable:!0,configurable:!0}),t.prototype.setMaxUploadRetryTime=function(t){ct("setMaxUploadRetryTime",[dt()],arguments),this.T.setMaxUploadRetryTime(t)},Object.defineProperty(t.prototype,"maxOperationRetryTime",{get:function(){return this.T.maxOperationRetryTime()},enumerable:!0,configurable:!0}),t.prototype.setMaxOperationRetryTime=function(t){ct("setMaxOperationRetryTime",[dt()],arguments),this.T.setMaxOperationRetryTime(t)},Object.defineProperty(t.prototype,"app",{get:function(){return this.ot},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"INTERNAL",{get:function(){return this.Ct},enumerable:!0,configurable:!0}),t}(),Oe=function(){function t(t){this.lt=t}return t.prototype.delete=function(){return this.lt.T.deleteApp(),P(void 0)},t}();e.registerStorage=Ht;var Ce="storage";Ht(n(5).default)}},[23])}catch(t){throw Error("Cannot instantiate firebase-storage.js - be sure to load firebase-app.js first.")}


//! moment.js
//! version : 2.18.1
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

var hookCallback;

function hooks () {
    return hookCallback.apply(null, arguments);
}

// This is done to register the method called with moment()
// without creating circular dependencies.
function setHookCallback (callback) {
    hookCallback = callback;
}

function isArray(input) {
    return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
}

function isObject(input) {
    // IE8 will treat undefined and null as object if it wasn't for
    // input != null
    return input != null && Object.prototype.toString.call(input) === '[object Object]';
}

function isObjectEmpty(obj) {
    var k;
    for (k in obj) {
        // even if its not own property I'd still call it non-empty
        return false;
    }
    return true;
}

function isUndefined(input) {
    return input === void 0;
}

function isNumber(input) {
    return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
}

function isDate(input) {
    return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
}

function map(arr, fn) {
    var res = [], i;
    for (i = 0; i < arr.length; ++i) {
        res.push(fn(arr[i], i));
    }
    return res;
}

function hasOwnProp(a, b) {
    return Object.prototype.hasOwnProperty.call(a, b);
}

function extend(a, b) {
    for (var i in b) {
        if (hasOwnProp(b, i)) {
            a[i] = b[i];
        }
    }

    if (hasOwnProp(b, 'toString')) {
        a.toString = b.toString;
    }

    if (hasOwnProp(b, 'valueOf')) {
        a.valueOf = b.valueOf;
    }

    return a;
}

function createUTC (input, format, locale, strict) {
    return createLocalOrUTC(input, format, locale, strict, true).utc();
}

function defaultParsingFlags() {
    // We need to deep clone this object.
    return {
        empty           : false,
        unusedTokens    : [],
        unusedInput     : [],
        overflow        : -2,
        charsLeftOver   : 0,
        nullInput       : false,
        invalidMonth    : null,
        invalidFormat   : false,
        userInvalidated : false,
        iso             : false,
        parsedDateParts : [],
        meridiem        : null,
        rfc2822         : false,
        weekdayMismatch : false
    };
}

function getParsingFlags(m) {
    if (m._pf == null) {
        m._pf = defaultParsingFlags();
    }
    return m._pf;
}

var some;
if (Array.prototype.some) {
    some = Array.prototype.some;
} else {
    some = function (fun) {
        var t = Object(this);
        var len = t.length >>> 0;

        for (var i = 0; i < len; i++) {
            if (i in t && fun.call(this, t[i], i, t)) {
                return true;
            }
        }

        return false;
    };
}

var some$1 = some;

function isValid(m) {
    if (m._isValid == null) {
        var flags = getParsingFlags(m);
        var parsedParts = some$1.call(flags.parsedDateParts, function (i) {
            return i != null;
        });
        var isNowValid = !isNaN(m._d.getTime()) &&
            flags.overflow < 0 &&
            !flags.empty &&
            !flags.invalidMonth &&
            !flags.invalidWeekday &&
            !flags.nullInput &&
            !flags.invalidFormat &&
            !flags.userInvalidated &&
            (!flags.meridiem || (flags.meridiem && parsedParts));

        if (m._strict) {
            isNowValid = isNowValid &&
                flags.charsLeftOver === 0 &&
                flags.unusedTokens.length === 0 &&
                flags.bigHour === undefined;
        }

        if (Object.isFrozen == null || !Object.isFrozen(m)) {
            m._isValid = isNowValid;
        }
        else {
            return isNowValid;
        }
    }
    return m._isValid;
}

function createInvalid (flags) {
    var m = createUTC(NaN);
    if (flags != null) {
        extend(getParsingFlags(m), flags);
    }
    else {
        getParsingFlags(m).userInvalidated = true;
    }

    return m;
}

// Plugins that add properties should also add the key here (null value),
// so we can properly clone ourselves.
var momentProperties = hooks.momentProperties = [];

function copyConfig(to, from) {
    var i, prop, val;

    if (!isUndefined(from._isAMomentObject)) {
        to._isAMomentObject = from._isAMomentObject;
    }
    if (!isUndefined(from._i)) {
        to._i = from._i;
    }
    if (!isUndefined(from._f)) {
        to._f = from._f;
    }
    if (!isUndefined(from._l)) {
        to._l = from._l;
    }
    if (!isUndefined(from._strict)) {
        to._strict = from._strict;
    }
    if (!isUndefined(from._tzm)) {
        to._tzm = from._tzm;
    }
    if (!isUndefined(from._isUTC)) {
        to._isUTC = from._isUTC;
    }
    if (!isUndefined(from._offset)) {
        to._offset = from._offset;
    }
    if (!isUndefined(from._pf)) {
        to._pf = getParsingFlags(from);
    }
    if (!isUndefined(from._locale)) {
        to._locale = from._locale;
    }

    if (momentProperties.length > 0) {
        for (i = 0; i < momentProperties.length; i++) {
            prop = momentProperties[i];
            val = from[prop];
            if (!isUndefined(val)) {
                to[prop] = val;
            }
        }
    }

    return to;
}

var updateInProgress = false;

// Moment prototype object
function Moment(config) {
    copyConfig(this, config);
    this._d = new Date(config._d != null ? config._d.getTime() : NaN);
    if (!this.isValid()) {
        this._d = new Date(NaN);
    }
    // Prevent infinite loop in case updateOffset creates new moment
    // objects.
    if (updateInProgress === false) {
        updateInProgress = true;
        hooks.updateOffset(this);
        updateInProgress = false;
    }
}

function isMoment (obj) {
    return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
}

function absFloor (number) {
    if (number < 0) {
        // -0 -> 0
        return Math.ceil(number) || 0;
    } else {
        return Math.floor(number);
    }
}

function toInt(argumentForCoercion) {
    var coercedNumber = +argumentForCoercion,
        value = 0;

    if (coercedNumber !== 0 && isFinite(coercedNumber)) {
        value = absFloor(coercedNumber);
    }

    return value;
}

// compare two arrays, return the number of differences
function compareArrays(array1, array2, dontConvert) {
    var len = Math.min(array1.length, array2.length),
        lengthDiff = Math.abs(array1.length - array2.length),
        diffs = 0,
        i;
    for (i = 0; i < len; i++) {
        if ((dontConvert && array1[i] !== array2[i]) ||
            (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
            diffs++;
        }
    }
    return diffs + lengthDiff;
}

function warn(msg) {
    if (hooks.suppressDeprecationWarnings === false &&
            (typeof console !==  'undefined') && console.warn) {
        console.warn('Deprecation warning: ' + msg);
    }
}

function deprecate(msg, fn) {
    var firstTime = true;

    return extend(function () {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(null, msg);
        }
        if (firstTime) {
            var args = [];
            var arg;
            for (var i = 0; i < arguments.length; i++) {
                arg = '';
                if (typeof arguments[i] === 'object') {
                    arg += '\n[' + i + '] ';
                    for (var key in arguments[0]) {
                        arg += key + ': ' + arguments[0][key] + ', ';
                    }
                    arg = arg.slice(0, -2); // Remove trailing comma and space
                } else {
                    arg = arguments[i];
                }
                args.push(arg);
            }
            warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
            firstTime = false;
        }
        return fn.apply(this, arguments);
    }, fn);
}

var deprecations = {};

function deprecateSimple(name, msg) {
    if (hooks.deprecationHandler != null) {
        hooks.deprecationHandler(name, msg);
    }
    if (!deprecations[name]) {
        warn(msg);
        deprecations[name] = true;
    }
}

hooks.suppressDeprecationWarnings = false;
hooks.deprecationHandler = null;

function isFunction(input) {
    return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
}

function set (config) {
    var prop, i;
    for (i in config) {
        prop = config[i];
        if (isFunction(prop)) {
            this[i] = prop;
        } else {
            this['_' + i] = prop;
        }
    }
    this._config = config;
    // Lenient ordinal parsing accepts just a number in addition to
    // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
    // TODO: Remove "ordinalParse" fallback in next major release.
    this._dayOfMonthOrdinalParseLenient = new RegExp(
        (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
            '|' + (/\d{1,2}/).source);
}

function mergeConfigs(parentConfig, childConfig) {
    var res = extend({}, parentConfig), prop;
    for (prop in childConfig) {
        if (hasOwnProp(childConfig, prop)) {
            if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                res[prop] = {};
                extend(res[prop], parentConfig[prop]);
                extend(res[prop], childConfig[prop]);
            } else if (childConfig[prop] != null) {
                res[prop] = childConfig[prop];
            } else {
                delete res[prop];
            }
        }
    }
    for (prop in parentConfig) {
        if (hasOwnProp(parentConfig, prop) &&
                !hasOwnProp(childConfig, prop) &&
                isObject(parentConfig[prop])) {
            // make sure changes to properties don't modify parent config
            res[prop] = extend({}, res[prop]);
        }
    }
    return res;
}

function Locale(config) {
    if (config != null) {
        this.set(config);
    }
}

var keys;

if (Object.keys) {
    keys = Object.keys;
} else {
    keys = function (obj) {
        var i, res = [];
        for (i in obj) {
            if (hasOwnProp(obj, i)) {
                res.push(i);
            }
        }
        return res;
    };
}

var keys$1 = keys;

var defaultCalendar = {
    sameDay : '[Today at] LT',
    nextDay : '[Tomorrow at] LT',
    nextWeek : 'dddd [at] LT',
    lastDay : '[Yesterday at] LT',
    lastWeek : '[Last] dddd [at] LT',
    sameElse : 'L'
};

function calendar (key, mom, now) {
    var output = this._calendar[key] || this._calendar['sameElse'];
    return isFunction(output) ? output.call(mom, now) : output;
}

var defaultLongDateFormat = {
    LTS  : 'h:mm:ss A',
    LT   : 'h:mm A',
    L    : 'MM/DD/YYYY',
    LL   : 'MMMM D, YYYY',
    LLL  : 'MMMM D, YYYY h:mm A',
    LLLL : 'dddd, MMMM D, YYYY h:mm A'
};

function longDateFormat (key) {
    var format = this._longDateFormat[key],
        formatUpper = this._longDateFormat[key.toUpperCase()];

    if (format || !formatUpper) {
        return format;
    }

    this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
        return val.slice(1);
    });

    return this._longDateFormat[key];
}

var defaultInvalidDate = 'Invalid date';

function invalidDate () {
    return this._invalidDate;
}

var defaultOrdinal = '%d';
var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

function ordinal (number) {
    return this._ordinal.replace('%d', number);
}

var defaultRelativeTime = {
    future : 'in %s',
    past   : '%s ago',
    s  : 'a few seconds',
    ss : '%d seconds',
    m  : 'a minute',
    mm : '%d minutes',
    h  : 'an hour',
    hh : '%d hours',
    d  : 'a day',
    dd : '%d days',
    M  : 'a month',
    MM : '%d months',
    y  : 'a year',
    yy : '%d years'
};

function relativeTime (number, withoutSuffix, string, isFuture) {
    var output = this._relativeTime[string];
    return (isFunction(output)) ?
        output(number, withoutSuffix, string, isFuture) :
        output.replace(/%d/i, number);
}

function pastFuture (diff, output) {
    var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
    return isFunction(format) ? format(output) : format.replace(/%s/i, output);
}

var aliases = {};

function addUnitAlias (unit, shorthand) {
    var lowerCase = unit.toLowerCase();
    aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
}

function normalizeUnits(units) {
    return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
}

function normalizeObjectUnits(inputObject) {
    var normalizedInput = {},
        normalizedProp,
        prop;

    for (prop in inputObject) {
        if (hasOwnProp(inputObject, prop)) {
            normalizedProp = normalizeUnits(prop);
            if (normalizedProp) {
                normalizedInput[normalizedProp] = inputObject[prop];
            }
        }
    }

    return normalizedInput;
}

var priorities = {};

function addUnitPriority(unit, priority) {
    priorities[unit] = priority;
}

function getPrioritizedUnits(unitsObj) {
    var units = [];
    for (var u in unitsObj) {
        units.push({unit: u, priority: priorities[u]});
    }
    units.sort(function (a, b) {
        return a.priority - b.priority;
    });
    return units;
}

function makeGetSet (unit, keepTime) {
    return function (value) {
        if (value != null) {
            set$1(this, unit, value);
            hooks.updateOffset(this, keepTime);
            return this;
        } else {
            return get(this, unit);
        }
    };
}

function get (mom, unit) {
    return mom.isValid() ?
        mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
}

function set$1 (mom, unit, value) {
    if (mom.isValid()) {
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
    }
}

// MOMENTS

function stringGet (units) {
    units = normalizeUnits(units);
    if (isFunction(this[units])) {
        return this[units]();
    }
    return this;
}


function stringSet (units, value) {
    if (typeof units === 'object') {
        units = normalizeObjectUnits(units);
        var prioritized = getPrioritizedUnits(units);
        for (var i = 0; i < prioritized.length; i++) {
            this[prioritized[i].unit](units[prioritized[i].unit]);
        }
    } else {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units](value);
        }
    }
    return this;
}

function zeroFill(number, targetLength, forceSign) {
    var absNumber = '' + Math.abs(number),
        zerosToFill = targetLength - absNumber.length,
        sign = number >= 0;
    return (sign ? (forceSign ? '+' : '') : '-') +
        Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
}

var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

var formatFunctions = {};

var formatTokenFunctions = {};

// token:    'M'
// padded:   ['MM', 2]
// ordinal:  'Mo'
// callback: function () { this.month() + 1 }
function addFormatToken (token, padded, ordinal, callback) {
    var func = callback;
    if (typeof callback === 'string') {
        func = function () {
            return this[callback]();
        };
    }
    if (token) {
        formatTokenFunctions[token] = func;
    }
    if (padded) {
        formatTokenFunctions[padded[0]] = function () {
            return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
        };
    }
    if (ordinal) {
        formatTokenFunctions[ordinal] = function () {
            return this.localeData().ordinal(func.apply(this, arguments), token);
        };
    }
}

function removeFormattingTokens(input) {
    if (input.match(/\[[\s\S]/)) {
        return input.replace(/^\[|\]$/g, '');
    }
    return input.replace(/\\/g, '');
}

function makeFormatFunction(format) {
    var array = format.match(formattingTokens), i, length;

    for (i = 0, length = array.length; i < length; i++) {
        if (formatTokenFunctions[array[i]]) {
            array[i] = formatTokenFunctions[array[i]];
        } else {
            array[i] = removeFormattingTokens(array[i]);
        }
    }

    return function (mom) {
        var output = '', i;
        for (i = 0; i < length; i++) {
            output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
        }
        return output;
    };
}

// format date using native date object
function formatMoment(m, format) {
    if (!m.isValid()) {
        return m.localeData().invalidDate();
    }

    format = expandFormat(format, m.localeData());
    formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

    return formatFunctions[format](m);
}

function expandFormat(format, locale) {
    var i = 5;

    function replaceLongDateFormatTokens(input) {
        return locale.longDateFormat(input) || input;
    }

    localFormattingTokens.lastIndex = 0;
    while (i >= 0 && localFormattingTokens.test(format)) {
        format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
        localFormattingTokens.lastIndex = 0;
        i -= 1;
    }

    return format;
}

var match1         = /\d/;            //       0 - 9
var match2         = /\d\d/;          //      00 - 99
var match3         = /\d{3}/;         //     000 - 999
var match4         = /\d{4}/;         //    0000 - 9999
var match6         = /[+-]?\d{6}/;    // -999999 - 999999
var match1to2      = /\d\d?/;         //       0 - 99
var match3to4      = /\d\d\d\d?/;     //     999 - 9999
var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
var match1to3      = /\d{1,3}/;       //       0 - 999
var match1to4      = /\d{1,4}/;       //       0 - 9999
var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

var matchUnsigned  = /\d+/;           //       0 - inf
var matchSigned    = /[+-]?\d+/;      //    -inf - inf

var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

// any word (or two) characters or numbers including two/three word month in arabic.
// includes scottish gaelic two word and hyphenated months
var matchWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i;


var regexes = {};

function addRegexToken (token, regex, strictRegex) {
    regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
        return (isStrict && strictRegex) ? strictRegex : regex;
    };
}

function getParseRegexForToken (token, config) {
    if (!hasOwnProp(regexes, token)) {
        return new RegExp(unescapeFormat(token));
    }

    return regexes[token](config._strict, config._locale);
}

// Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
function unescapeFormat(s) {
    return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
        return p1 || p2 || p3 || p4;
    }));
}

function regexEscape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

var tokens = {};

function addParseToken (token, callback) {
    var i, func = callback;
    if (typeof token === 'string') {
        token = [token];
    }
    if (isNumber(callback)) {
        func = function (input, array) {
            array[callback] = toInt(input);
        };
    }
    for (i = 0; i < token.length; i++) {
        tokens[token[i]] = func;
    }
}

function addWeekParseToken (token, callback) {
    addParseToken(token, function (input, array, config, token) {
        config._w = config._w || {};
        callback(input, config._w, config, token);
    });
}

function addTimeToArrayFromToken(token, input, config) {
    if (input != null && hasOwnProp(tokens, token)) {
        tokens[token](input, config._a, config, token);
    }
}

var YEAR = 0;
var MONTH = 1;
var DATE = 2;
var HOUR = 3;
var MINUTE = 4;
var SECOND = 5;
var MILLISECOND = 6;
var WEEK = 7;
var WEEKDAY = 8;

var indexOf;

if (Array.prototype.indexOf) {
    indexOf = Array.prototype.indexOf;
} else {
    indexOf = function (o) {
        // I know
        var i;
        for (i = 0; i < this.length; ++i) {
            if (this[i] === o) {
                return i;
            }
        }
        return -1;
    };
}

var indexOf$1 = indexOf;

function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// FORMATTING

addFormatToken('M', ['MM', 2], 'Mo', function () {
    return this.month() + 1;
});

addFormatToken('MMM', 0, 0, function (format) {
    return this.localeData().monthsShort(this, format);
});

addFormatToken('MMMM', 0, 0, function (format) {
    return this.localeData().months(this, format);
});

// ALIASES

addUnitAlias('month', 'M');

// PRIORITY

addUnitPriority('month', 8);

// PARSING

addRegexToken('M',    match1to2);
addRegexToken('MM',   match1to2, match2);
addRegexToken('MMM',  function (isStrict, locale) {
    return locale.monthsShortRegex(isStrict);
});
addRegexToken('MMMM', function (isStrict, locale) {
    return locale.monthsRegex(isStrict);
});

addParseToken(['M', 'MM'], function (input, array) {
    array[MONTH] = toInt(input) - 1;
});

addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
    var month = config._locale.monthsParse(input, token, config._strict);
    // if we didn't find a month name, mark the date as invalid.
    if (month != null) {
        array[MONTH] = month;
    } else {
        getParsingFlags(config).invalidMonth = input;
    }
});

// LOCALES

var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
function localeMonths (m, format) {
    if (!m) {
        return isArray(this._months) ? this._months :
            this._months['standalone'];
    }
    return isArray(this._months) ? this._months[m.month()] :
        this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
}

var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
function localeMonthsShort (m, format) {
    if (!m) {
        return isArray(this._monthsShort) ? this._monthsShort :
            this._monthsShort['standalone'];
    }
    return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
        this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
}

function handleStrictParse(monthName, format, strict) {
    var i, ii, mom, llc = monthName.toLocaleLowerCase();
    if (!this._monthsParse) {
        // this is not used
        this._monthsParse = [];
        this._longMonthsParse = [];
        this._shortMonthsParse = [];
        for (i = 0; i < 12; ++i) {
            mom = createUTC([2000, i]);
            this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
            this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
        }
    }

    if (strict) {
        if (format === 'MMM') {
            ii = indexOf$1.call(this._shortMonthsParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._longMonthsParse, llc);
            return ii !== -1 ? ii : null;
        }
    } else {
        if (format === 'MMM') {
            ii = indexOf$1.call(this._shortMonthsParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._longMonthsParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._longMonthsParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._shortMonthsParse, llc);
            return ii !== -1 ? ii : null;
        }
    }
}

function localeMonthsParse (monthName, format, strict) {
    var i, mom, regex;

    if (this._monthsParseExact) {
        return handleStrictParse.call(this, monthName, format, strict);
    }

    if (!this._monthsParse) {
        this._monthsParse = [];
        this._longMonthsParse = [];
        this._shortMonthsParse = [];
    }

    // TODO: add sorting
    // Sorting makes sure if one month (or abbr) is a prefix of another
    // see sorting in computeMonthsParse
    for (i = 0; i < 12; i++) {
        // make the regex if we don't have it already
        mom = createUTC([2000, i]);
        if (strict && !this._longMonthsParse[i]) {
            this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
            this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
        }
        if (!strict && !this._monthsParse[i]) {
            regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
            this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
        }
        // test the regex
        if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
            return i;
        } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
            return i;
        } else if (!strict && this._monthsParse[i].test(monthName)) {
            return i;
        }
    }
}

// MOMENTS

function setMonth (mom, value) {
    var dayOfMonth;

    if (!mom.isValid()) {
        // No op
        return mom;
    }

    if (typeof value === 'string') {
        if (/^\d+$/.test(value)) {
            value = toInt(value);
        } else {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (!isNumber(value)) {
                return mom;
            }
        }
    }

    dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
    mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
    return mom;
}

function getSetMonth (value) {
    if (value != null) {
        setMonth(this, value);
        hooks.updateOffset(this, true);
        return this;
    } else {
        return get(this, 'Month');
    }
}

function getDaysInMonth () {
    return daysInMonth(this.year(), this.month());
}

var defaultMonthsShortRegex = matchWord;
function monthsShortRegex (isStrict) {
    if (this._monthsParseExact) {
        if (!hasOwnProp(this, '_monthsRegex')) {
            computeMonthsParse.call(this);
        }
        if (isStrict) {
            return this._monthsShortStrictRegex;
        } else {
            return this._monthsShortRegex;
        }
    } else {
        if (!hasOwnProp(this, '_monthsShortRegex')) {
            this._monthsShortRegex = defaultMonthsShortRegex;
        }
        return this._monthsShortStrictRegex && isStrict ?
            this._monthsShortStrictRegex : this._monthsShortRegex;
    }
}

var defaultMonthsRegex = matchWord;
function monthsRegex (isStrict) {
    if (this._monthsParseExact) {
        if (!hasOwnProp(this, '_monthsRegex')) {
            computeMonthsParse.call(this);
        }
        if (isStrict) {
            return this._monthsStrictRegex;
        } else {
            return this._monthsRegex;
        }
    } else {
        if (!hasOwnProp(this, '_monthsRegex')) {
            this._monthsRegex = defaultMonthsRegex;
        }
        return this._monthsStrictRegex && isStrict ?
            this._monthsStrictRegex : this._monthsRegex;
    }
}

function computeMonthsParse () {
    function cmpLenRev(a, b) {
        return b.length - a.length;
    }

    var shortPieces = [], longPieces = [], mixedPieces = [],
        i, mom;
    for (i = 0; i < 12; i++) {
        // make the regex if we don't have it already
        mom = createUTC([2000, i]);
        shortPieces.push(this.monthsShort(mom, ''));
        longPieces.push(this.months(mom, ''));
        mixedPieces.push(this.months(mom, ''));
        mixedPieces.push(this.monthsShort(mom, ''));
    }
    // Sorting makes sure if one month (or abbr) is a prefix of another it
    // will match the longer piece.
    shortPieces.sort(cmpLenRev);
    longPieces.sort(cmpLenRev);
    mixedPieces.sort(cmpLenRev);
    for (i = 0; i < 12; i++) {
        shortPieces[i] = regexEscape(shortPieces[i]);
        longPieces[i] = regexEscape(longPieces[i]);
    }
    for (i = 0; i < 24; i++) {
        mixedPieces[i] = regexEscape(mixedPieces[i]);
    }

    this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
    this._monthsShortRegex = this._monthsRegex;
    this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
    this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
}

// FORMATTING

addFormatToken('Y', 0, 0, function () {
    var y = this.year();
    return y <= 9999 ? '' + y : '+' + y;
});

addFormatToken(0, ['YY', 2], 0, function () {
    return this.year() % 100;
});

addFormatToken(0, ['YYYY',   4],       0, 'year');
addFormatToken(0, ['YYYYY',  5],       0, 'year');
addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

// ALIASES

addUnitAlias('year', 'y');

// PRIORITIES

addUnitPriority('year', 1);

// PARSING

addRegexToken('Y',      matchSigned);
addRegexToken('YY',     match1to2, match2);
addRegexToken('YYYY',   match1to4, match4);
addRegexToken('YYYYY',  match1to6, match6);
addRegexToken('YYYYYY', match1to6, match6);

addParseToken(['YYYYY', 'YYYYYY'], YEAR);
addParseToken('YYYY', function (input, array) {
    array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
});
addParseToken('YY', function (input, array) {
    array[YEAR] = hooks.parseTwoDigitYear(input);
});
addParseToken('Y', function (input, array) {
    array[YEAR] = parseInt(input, 10);
});

// HELPERS

function daysInYear(year) {
    return isLeapYear(year) ? 366 : 365;
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// HOOKS

hooks.parseTwoDigitYear = function (input) {
    return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
};

// MOMENTS

var getSetYear = makeGetSet('FullYear', true);

function getIsLeapYear () {
    return isLeapYear(this.year());
}

function createDate (y, m, d, h, M, s, ms) {
    // can't just apply() to create a date:
    // https://stackoverflow.com/q/181348
    var date = new Date(y, m, d, h, M, s, ms);

    // the date constructor remaps years 0-99 to 1900-1999
    if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
        date.setFullYear(y);
    }
    return date;
}

function createUTCDate (y) {
    var date = new Date(Date.UTC.apply(null, arguments));

    // the Date.UTC function remaps years 0-99 to 1900-1999
    if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
        date.setUTCFullYear(y);
    }
    return date;
}

// start-of-first-week - start-of-year
function firstWeekOffset(year, dow, doy) {
    var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
        fwd = 7 + dow - doy,
        // first-week day local weekday -- which local weekday is fwd
        fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

    return -fwdlw + fwd - 1;
}

// https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
    var localWeekday = (7 + weekday - dow) % 7,
        weekOffset = firstWeekOffset(year, dow, doy),
        dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
        resYear, resDayOfYear;

    if (dayOfYear <= 0) {
        resYear = year - 1;
        resDayOfYear = daysInYear(resYear) + dayOfYear;
    } else if (dayOfYear > daysInYear(year)) {
        resYear = year + 1;
        resDayOfYear = dayOfYear - daysInYear(year);
    } else {
        resYear = year;
        resDayOfYear = dayOfYear;
    }

    return {
        year: resYear,
        dayOfYear: resDayOfYear
    };
}

function weekOfYear(mom, dow, doy) {
    var weekOffset = firstWeekOffset(mom.year(), dow, doy),
        week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
        resWeek, resYear;

    if (week < 1) {
        resYear = mom.year() - 1;
        resWeek = week + weeksInYear(resYear, dow, doy);
    } else if (week > weeksInYear(mom.year(), dow, doy)) {
        resWeek = week - weeksInYear(mom.year(), dow, doy);
        resYear = mom.year() + 1;
    } else {
        resYear = mom.year();
        resWeek = week;
    }

    return {
        week: resWeek,
        year: resYear
    };
}

function weeksInYear(year, dow, doy) {
    var weekOffset = firstWeekOffset(year, dow, doy),
        weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
    return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
}

// FORMATTING

addFormatToken('w', ['ww', 2], 'wo', 'week');
addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

// ALIASES

addUnitAlias('week', 'w');
addUnitAlias('isoWeek', 'W');

// PRIORITIES

addUnitPriority('week', 5);
addUnitPriority('isoWeek', 5);

// PARSING

addRegexToken('w',  match1to2);
addRegexToken('ww', match1to2, match2);
addRegexToken('W',  match1to2);
addRegexToken('WW', match1to2, match2);

addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
    week[token.substr(0, 1)] = toInt(input);
});

// HELPERS

// LOCALES

function localeWeek (mom) {
    return weekOfYear(mom, this._week.dow, this._week.doy).week;
}

var defaultLocaleWeek = {
    dow : 0, // Sunday is the first day of the week.
    doy : 6  // The week that contains Jan 1st is the first week of the year.
};

function localeFirstDayOfWeek () {
    return this._week.dow;
}

function localeFirstDayOfYear () {
    return this._week.doy;
}

// MOMENTS

function getSetWeek (input) {
    var week = this.localeData().week(this);
    return input == null ? week : this.add((input - week) * 7, 'd');
}

function getSetISOWeek (input) {
    var week = weekOfYear(this, 1, 4).week;
    return input == null ? week : this.add((input - week) * 7, 'd');
}

// FORMATTING

addFormatToken('d', 0, 'do', 'day');

addFormatToken('dd', 0, 0, function (format) {
    return this.localeData().weekdaysMin(this, format);
});

addFormatToken('ddd', 0, 0, function (format) {
    return this.localeData().weekdaysShort(this, format);
});

addFormatToken('dddd', 0, 0, function (format) {
    return this.localeData().weekdays(this, format);
});

addFormatToken('e', 0, 0, 'weekday');
addFormatToken('E', 0, 0, 'isoWeekday');

// ALIASES

addUnitAlias('day', 'd');
addUnitAlias('weekday', 'e');
addUnitAlias('isoWeekday', 'E');

// PRIORITY
addUnitPriority('day', 11);
addUnitPriority('weekday', 11);
addUnitPriority('isoWeekday', 11);

// PARSING

addRegexToken('d',    match1to2);
addRegexToken('e',    match1to2);
addRegexToken('E',    match1to2);
addRegexToken('dd',   function (isStrict, locale) {
    return locale.weekdaysMinRegex(isStrict);
});
addRegexToken('ddd',   function (isStrict, locale) {
    return locale.weekdaysShortRegex(isStrict);
});
addRegexToken('dddd',   function (isStrict, locale) {
    return locale.weekdaysRegex(isStrict);
});

addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
    var weekday = config._locale.weekdaysParse(input, token, config._strict);
    // if we didn't get a weekday name, mark the date as invalid
    if (weekday != null) {
        week.d = weekday;
    } else {
        getParsingFlags(config).invalidWeekday = input;
    }
});

addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
    week[token] = toInt(input);
});

// HELPERS

function parseWeekday(input, locale) {
    if (typeof input !== 'string') {
        return input;
    }

    if (!isNaN(input)) {
        return parseInt(input, 10);
    }

    input = locale.weekdaysParse(input);
    if (typeof input === 'number') {
        return input;
    }

    return null;
}

function parseIsoWeekday(input, locale) {
    if (typeof input === 'string') {
        return locale.weekdaysParse(input) % 7 || 7;
    }
    return isNaN(input) ? null : input;
}

// LOCALES

var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
function localeWeekdays (m, format) {
    if (!m) {
        return isArray(this._weekdays) ? this._weekdays :
            this._weekdays['standalone'];
    }
    return isArray(this._weekdays) ? this._weekdays[m.day()] :
        this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
}

var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
function localeWeekdaysShort (m) {
    return (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
}

var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
function localeWeekdaysMin (m) {
    return (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
}

function handleStrictParse$1(weekdayName, format, strict) {
    var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
    if (!this._weekdaysParse) {
        this._weekdaysParse = [];
        this._shortWeekdaysParse = [];
        this._minWeekdaysParse = [];

        for (i = 0; i < 7; ++i) {
            mom = createUTC([2000, 1]).day(i);
            this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
            this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
            this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
        }
    }

    if (strict) {
        if (format === 'dddd') {
            ii = indexOf$1.call(this._weekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else if (format === 'ddd') {
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        }
    } else {
        if (format === 'dddd') {
            ii = indexOf$1.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else if (format === 'ddd') {
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf$1.call(this._minWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf$1.call(this._shortWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        }
    }
}

function localeWeekdaysParse (weekdayName, format, strict) {
    var i, mom, regex;

    if (this._weekdaysParseExact) {
        return handleStrictParse$1.call(this, weekdayName, format, strict);
    }

    if (!this._weekdaysParse) {
        this._weekdaysParse = [];
        this._minWeekdaysParse = [];
        this._shortWeekdaysParse = [];
        this._fullWeekdaysParse = [];
    }

    for (i = 0; i < 7; i++) {
        // make the regex if we don't have it already

        mom = createUTC([2000, 1]).day(i);
        if (strict && !this._fullWeekdaysParse[i]) {
            this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\.?') + '$', 'i');
            this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\.?') + '$', 'i');
            this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\.?') + '$', 'i');
        }
        if (!this._weekdaysParse[i]) {
            regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
            this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
        }
        // test the regex
        if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
            return i;
        } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
            return i;
        } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
            return i;
        } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
            return i;
        }
    }
}

// MOMENTS

function getSetDayOfWeek (input) {
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
    if (input != null) {
        input = parseWeekday(input, this.localeData());
        return this.add(input - day, 'd');
    } else {
        return day;
    }
}

function getSetLocaleDayOfWeek (input) {
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
    return input == null ? weekday : this.add(input - weekday, 'd');
}

function getSetISODayOfWeek (input) {
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }

    // behaves the same as moment#day except
    // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
    // as a setter, sunday should belong to the previous week.

    if (input != null) {
        var weekday = parseIsoWeekday(input, this.localeData());
        return this.day(this.day() % 7 ? weekday : weekday - 7);
    } else {
        return this.day() || 7;
    }
}

var defaultWeekdaysRegex = matchWord;
function weekdaysRegex (isStrict) {
    if (this._weekdaysParseExact) {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            computeWeekdaysParse.call(this);
        }
        if (isStrict) {
            return this._weekdaysStrictRegex;
        } else {
            return this._weekdaysRegex;
        }
    } else {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            this._weekdaysRegex = defaultWeekdaysRegex;
        }
        return this._weekdaysStrictRegex && isStrict ?
            this._weekdaysStrictRegex : this._weekdaysRegex;
    }
}

var defaultWeekdaysShortRegex = matchWord;
function weekdaysShortRegex (isStrict) {
    if (this._weekdaysParseExact) {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            computeWeekdaysParse.call(this);
        }
        if (isStrict) {
            return this._weekdaysShortStrictRegex;
        } else {
            return this._weekdaysShortRegex;
        }
    } else {
        if (!hasOwnProp(this, '_weekdaysShortRegex')) {
            this._weekdaysShortRegex = defaultWeekdaysShortRegex;
        }
        return this._weekdaysShortStrictRegex && isStrict ?
            this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
    }
}

var defaultWeekdaysMinRegex = matchWord;
function weekdaysMinRegex (isStrict) {
    if (this._weekdaysParseExact) {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            computeWeekdaysParse.call(this);
        }
        if (isStrict) {
            return this._weekdaysMinStrictRegex;
        } else {
            return this._weekdaysMinRegex;
        }
    } else {
        if (!hasOwnProp(this, '_weekdaysMinRegex')) {
            this._weekdaysMinRegex = defaultWeekdaysMinRegex;
        }
        return this._weekdaysMinStrictRegex && isStrict ?
            this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
    }
}


function computeWeekdaysParse () {
    function cmpLenRev(a, b) {
        return b.length - a.length;
    }

    var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
        i, mom, minp, shortp, longp;
    for (i = 0; i < 7; i++) {
        // make the regex if we don't have it already
        mom = createUTC([2000, 1]).day(i);
        minp = this.weekdaysMin(mom, '');
        shortp = this.weekdaysShort(mom, '');
        longp = this.weekdays(mom, '');
        minPieces.push(minp);
        shortPieces.push(shortp);
        longPieces.push(longp);
        mixedPieces.push(minp);
        mixedPieces.push(shortp);
        mixedPieces.push(longp);
    }
    // Sorting makes sure if one weekday (or abbr) is a prefix of another it
    // will match the longer piece.
    minPieces.sort(cmpLenRev);
    shortPieces.sort(cmpLenRev);
    longPieces.sort(cmpLenRev);
    mixedPieces.sort(cmpLenRev);
    for (i = 0; i < 7; i++) {
        shortPieces[i] = regexEscape(shortPieces[i]);
        longPieces[i] = regexEscape(longPieces[i]);
        mixedPieces[i] = regexEscape(mixedPieces[i]);
    }

    this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
    this._weekdaysShortRegex = this._weekdaysRegex;
    this._weekdaysMinRegex = this._weekdaysRegex;

    this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
    this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
}

// FORMATTING

function hFormat() {
    return this.hours() % 12 || 12;
}

function kFormat() {
    return this.hours() || 24;
}

addFormatToken('H', ['HH', 2], 0, 'hour');
addFormatToken('h', ['hh', 2], 0, hFormat);
addFormatToken('k', ['kk', 2], 0, kFormat);

addFormatToken('hmm', 0, 0, function () {
    return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
});

addFormatToken('hmmss', 0, 0, function () {
    return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
        zeroFill(this.seconds(), 2);
});

addFormatToken('Hmm', 0, 0, function () {
    return '' + this.hours() + zeroFill(this.minutes(), 2);
});

addFormatToken('Hmmss', 0, 0, function () {
    return '' + this.hours() + zeroFill(this.minutes(), 2) +
        zeroFill(this.seconds(), 2);
});

function meridiem (token, lowercase) {
    addFormatToken(token, 0, 0, function () {
        return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
    });
}

meridiem('a', true);
meridiem('A', false);

// ALIASES

addUnitAlias('hour', 'h');

// PRIORITY
addUnitPriority('hour', 13);

// PARSING

function matchMeridiem (isStrict, locale) {
    return locale._meridiemParse;
}

addRegexToken('a',  matchMeridiem);
addRegexToken('A',  matchMeridiem);
addRegexToken('H',  match1to2);
addRegexToken('h',  match1to2);
addRegexToken('k',  match1to2);
addRegexToken('HH', match1to2, match2);
addRegexToken('hh', match1to2, match2);
addRegexToken('kk', match1to2, match2);

addRegexToken('hmm', match3to4);
addRegexToken('hmmss', match5to6);
addRegexToken('Hmm', match3to4);
addRegexToken('Hmmss', match5to6);

addParseToken(['H', 'HH'], HOUR);
addParseToken(['k', 'kk'], function (input, array, config) {
    var kInput = toInt(input);
    array[HOUR] = kInput === 24 ? 0 : kInput;
});
addParseToken(['a', 'A'], function (input, array, config) {
    config._isPm = config._locale.isPM(input);
    config._meridiem = input;
});
addParseToken(['h', 'hh'], function (input, array, config) {
    array[HOUR] = toInt(input);
    getParsingFlags(config).bigHour = true;
});
addParseToken('hmm', function (input, array, config) {
    var pos = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos));
    array[MINUTE] = toInt(input.substr(pos));
    getParsingFlags(config).bigHour = true;
});
addParseToken('hmmss', function (input, array, config) {
    var pos1 = input.length - 4;
    var pos2 = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos1));
    array[MINUTE] = toInt(input.substr(pos1, 2));
    array[SECOND] = toInt(input.substr(pos2));
    getParsingFlags(config).bigHour = true;
});
addParseToken('Hmm', function (input, array, config) {
    var pos = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos));
    array[MINUTE] = toInt(input.substr(pos));
});
addParseToken('Hmmss', function (input, array, config) {
    var pos1 = input.length - 4;
    var pos2 = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos1));
    array[MINUTE] = toInt(input.substr(pos1, 2));
    array[SECOND] = toInt(input.substr(pos2));
});

// LOCALES

function localeIsPM (input) {
    // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
    // Using charAt should be more compatible.
    return ((input + '').toLowerCase().charAt(0) === 'p');
}

var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
function localeMeridiem (hours, minutes, isLower) {
    if (hours > 11) {
        return isLower ? 'pm' : 'PM';
    } else {
        return isLower ? 'am' : 'AM';
    }
}


// MOMENTS

// Setting the hour should keep the time, because the user explicitly
// specified which hour he wants. So trying to maintain the same hour (in
// a new timezone) makes sense. Adding/subtracting hours does not follow
// this rule.
var getSetHour = makeGetSet('Hours', true);

// months
// week
// weekdays
// meridiem
var baseConfig = {
    calendar: defaultCalendar,
    longDateFormat: defaultLongDateFormat,
    invalidDate: defaultInvalidDate,
    ordinal: defaultOrdinal,
    dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
    relativeTime: defaultRelativeTime,

    months: defaultLocaleMonths,
    monthsShort: defaultLocaleMonthsShort,

    week: defaultLocaleWeek,

    weekdays: defaultLocaleWeekdays,
    weekdaysMin: defaultLocaleWeekdaysMin,
    weekdaysShort: defaultLocaleWeekdaysShort,

    meridiemParse: defaultLocaleMeridiemParse
};

// internal storage for locale config files
var locales = {};
var localeFamilies = {};
var globalLocale;

function normalizeLocale(key) {
    return key ? key.toLowerCase().replace('_', '-') : key;
}

// pick the locale from the array
// try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
// substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
function chooseLocale(names) {
    var i = 0, j, next, locale, split;

    while (i < names.length) {
        split = normalizeLocale(names[i]).split('-');
        j = split.length;
        next = normalizeLocale(names[i + 1]);
        next = next ? next.split('-') : null;
        while (j > 0) {
            locale = loadLocale(split.slice(0, j).join('-'));
            if (locale) {
                return locale;
            }
            if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                //the next array item is better than a shallower substring of this one
                break;
            }
            j--;
        }
        i++;
    }
    return null;
}

function loadLocale(name) {
    var oldLocale = null;
    // TODO: Find a better way to register and load all the locales in Node
    if (!locales[name] && (typeof module !== 'undefined') &&
            module && module.exports) {
        try {
            oldLocale = globalLocale._abbr;
            require('./locale/' + name);
            // because defineLocale currently also sets the global locale, we
            // want to undo that for lazy loaded locales
            getSetGlobalLocale(oldLocale);
        } catch (e) { }
    }
    return locales[name];
}

// This function will load locale and then set the global locale.  If
// no arguments are passed in, it will simply return the current global
// locale key.
function getSetGlobalLocale (key, values) {
    var data;
    if (key) {
        if (isUndefined(values)) {
            data = getLocale(key);
        }
        else {
            data = defineLocale(key, values);
        }

        if (data) {
            // moment.duration._locale = moment._locale = data;
            globalLocale = data;
        }
    }

    return globalLocale._abbr;
}

function defineLocale (name, config) {
    if (config !== null) {
        var parentConfig = baseConfig;
        config.abbr = name;
        if (locales[name] != null) {
            deprecateSimple('defineLocaleOverride',
                    'use moment.updateLocale(localeName, config) to change ' +
                    'an existing locale. moment.defineLocale(localeName, ' +
                    'config) should only be used for creating a new locale ' +
                    'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
            parentConfig = locales[name]._config;
        } else if (config.parentLocale != null) {
            if (locales[config.parentLocale] != null) {
                parentConfig = locales[config.parentLocale]._config;
            } else {
                if (!localeFamilies[config.parentLocale]) {
                    localeFamilies[config.parentLocale] = [];
                }
                localeFamilies[config.parentLocale].push({
                    name: name,
                    config: config
                });
                return null;
            }
        }
        locales[name] = new Locale(mergeConfigs(parentConfig, config));

        if (localeFamilies[name]) {
            localeFamilies[name].forEach(function (x) {
                defineLocale(x.name, x.config);
            });
        }

        // backwards compat for now: also set the locale
        // make sure we set the locale AFTER all child locales have been
        // created, so we won't end up with the child locale set.
        getSetGlobalLocale(name);


        return locales[name];
    } else {
        // useful for testing
        delete locales[name];
        return null;
    }
}

function updateLocale(name, config) {
    if (config != null) {
        var locale, parentConfig = baseConfig;
        // MERGE
        if (locales[name] != null) {
            parentConfig = locales[name]._config;
        }
        config = mergeConfigs(parentConfig, config);
        locale = new Locale(config);
        locale.parentLocale = locales[name];
        locales[name] = locale;

        // backwards compat for now: also set the locale
        getSetGlobalLocale(name);
    } else {
        // pass null for config to unupdate, useful for tests
        if (locales[name] != null) {
            if (locales[name].parentLocale != null) {
                locales[name] = locales[name].parentLocale;
            } else if (locales[name] != null) {
                delete locales[name];
            }
        }
    }
    return locales[name];
}

// returns locale data
function getLocale (key) {
    var locale;

    if (key && key._locale && key._locale._abbr) {
        key = key._locale._abbr;
    }

    if (!key) {
        return globalLocale;
    }

    if (!isArray(key)) {
        //short-circuit everything else
        locale = loadLocale(key);
        if (locale) {
            return locale;
        }
        key = [key];
    }

    return chooseLocale(key);
}

function listLocales() {
    return keys$1(locales);
}

function checkOverflow (m) {
    var overflow;
    var a = m._a;

    if (a && getParsingFlags(m).overflow === -2) {
        overflow =
            a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
            a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
            a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
            a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
            a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
            a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
            -1;

        if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
            overflow = DATE;
        }
        if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
            overflow = WEEK;
        }
        if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
            overflow = WEEKDAY;
        }

        getParsingFlags(m).overflow = overflow;
    }

    return m;
}

// iso 8601 regex
// 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

var isoDates = [
    ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
    ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
    ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
    ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
    ['YYYY-DDD', /\d{4}-\d{3}/],
    ['YYYY-MM', /\d{4}-\d\d/, false],
    ['YYYYYYMMDD', /[+-]\d{10}/],
    ['YYYYMMDD', /\d{8}/],
    // YYYYMM is NOT allowed by the standard
    ['GGGG[W]WWE', /\d{4}W\d{3}/],
    ['GGGG[W]WW', /\d{4}W\d{2}/, false],
    ['YYYYDDD', /\d{7}/]
];

// iso time formats and regexes
var isoTimes = [
    ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
    ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
    ['HH:mm:ss', /\d\d:\d\d:\d\d/],
    ['HH:mm', /\d\d:\d\d/],
    ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
    ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
    ['HHmmss', /\d\d\d\d\d\d/],
    ['HHmm', /\d\d\d\d/],
    ['HH', /\d\d/]
];

var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

// date from iso format
function configFromISO(config) {
    var i, l,
        string = config._i,
        match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
        allowTime, dateFormat, timeFormat, tzFormat;

    if (match) {
        getParsingFlags(config).iso = true;

        for (i = 0, l = isoDates.length; i < l; i++) {
            if (isoDates[i][1].exec(match[1])) {
                dateFormat = isoDates[i][0];
                allowTime = isoDates[i][2] !== false;
                break;
            }
        }
        if (dateFormat == null) {
            config._isValid = false;
            return;
        }
        if (match[3]) {
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(match[3])) {
                    // match[2] should be 'T' or space
                    timeFormat = (match[2] || ' ') + isoTimes[i][0];
                    break;
                }
            }
            if (timeFormat == null) {
                config._isValid = false;
                return;
            }
        }
        if (!allowTime && timeFormat != null) {
            config._isValid = false;
            return;
        }
        if (match[4]) {
            if (tzRegex.exec(match[4])) {
                tzFormat = 'Z';
            } else {
                config._isValid = false;
                return;
            }
        }
        config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
        configFromStringAndFormat(config);
    } else {
        config._isValid = false;
    }
}

// RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
var basicRfcRegex = /^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d?\d\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(?:\d\d)?\d\d\s)(\d\d:\d\d)(\:\d\d)?(\s(?:UT|GMT|[ECMP][SD]T|[A-IK-Za-ik-z]|[+-]\d{4}))$/;

// date and time from ref 2822 format
function configFromRFC2822(config) {
    var string, match, dayFormat,
        dateFormat, timeFormat, tzFormat;
    var timezones = {
        ' GMT': ' +0000',
        ' EDT': ' -0400',
        ' EST': ' -0500',
        ' CDT': ' -0500',
        ' CST': ' -0600',
        ' MDT': ' -0600',
        ' MST': ' -0700',
        ' PDT': ' -0700',
        ' PST': ' -0800'
    };
    var military = 'YXWVUTSRQPONZABCDEFGHIKLM';
    var timezone, timezoneIndex;

    string = config._i
        .replace(/\([^\)]*\)|[\n\t]/g, ' ') // Remove comments and folding whitespace
        .replace(/(\s\s+)/g, ' ') // Replace multiple-spaces with a single space
        .replace(/^\s|\s$/g, ''); // Remove leading and trailing spaces
    match = basicRfcRegex.exec(string);

    if (match) {
        dayFormat = match[1] ? 'ddd' + ((match[1].length === 5) ? ', ' : ' ') : '';
        dateFormat = 'D MMM ' + ((match[2].length > 10) ? 'YYYY ' : 'YY ');
        timeFormat = 'HH:mm' + (match[4] ? ':ss' : '');

        // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
        if (match[1]) { // day of week given
            var momentDate = new Date(match[2]);
            var momentDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][momentDate.getDay()];

            if (match[1].substr(0,3) !== momentDay) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return;
            }
        }

        switch (match[5].length) {
            case 2: // military
                if (timezoneIndex === 0) {
                    timezone = ' +0000';
                } else {
                    timezoneIndex = military.indexOf(match[5][1].toUpperCase()) - 12;
                    timezone = ((timezoneIndex < 0) ? ' -' : ' +') +
                        (('' + timezoneIndex).replace(/^-?/, '0')).match(/..$/)[0] + '00';
                }
                break;
            case 4: // Zone
                timezone = timezones[match[5]];
                break;
            default: // UT or +/-9999
                timezone = timezones[' GMT'];
        }
        match[5] = timezone;
        config._i = match.splice(1).join('');
        tzFormat = ' ZZ';
        config._f = dayFormat + dateFormat + timeFormat + tzFormat;
        configFromStringAndFormat(config);
        getParsingFlags(config).rfc2822 = true;
    } else {
        config._isValid = false;
    }
}

// date from iso format or fallback
function configFromString(config) {
    var matched = aspNetJsonRegex.exec(config._i);

    if (matched !== null) {
        config._d = new Date(+matched[1]);
        return;
    }

    configFromISO(config);
    if (config._isValid === false) {
        delete config._isValid;
    } else {
        return;
    }

    configFromRFC2822(config);
    if (config._isValid === false) {
        delete config._isValid;
    } else {
        return;
    }

    // Final attempt, use Input Fallback
    hooks.createFromInputFallback(config);
}

hooks.createFromInputFallback = deprecate(
    'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
    'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
    'discouraged and will be removed in an upcoming major release. Please refer to ' +
    'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
    function (config) {
        config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
    }
);

// Pick the first defined of two or three arguments.
function defaults(a, b, c) {
    if (a != null) {
        return a;
    }
    if (b != null) {
        return b;
    }
    return c;
}

function currentDateArray(config) {
    // hooks is actually the exported moment object
    var nowValue = new Date(hooks.now());
    if (config._useUTC) {
        return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
    }
    return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
}

// convert an array to a date.
// the array should mirror the parameters below
// note: all values past the year are optional and will default to the lowest possible value.
// [year, month, day , hour, minute, second, millisecond]
function configFromArray (config) {
    var i, date, input = [], currentDate, yearToUse;

    if (config._d) {
        return;
    }

    currentDate = currentDateArray(config);

    //compute day of the year from weeks and weekdays
    if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
        dayOfYearFromWeekInfo(config);
    }

    //if the day of the year is set, figure out what it is
    if (config._dayOfYear != null) {
        yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

        if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
            getParsingFlags(config)._overflowDayOfYear = true;
        }

        date = createUTCDate(yearToUse, 0, config._dayOfYear);
        config._a[MONTH] = date.getUTCMonth();
        config._a[DATE] = date.getUTCDate();
    }

    // Default to current date.
    // * if no year, month, day of month are given, default to today
    // * if day of month is given, default month and year
    // * if month is given, default only year
    // * if year is given, don't default anything
    for (i = 0; i < 3 && config._a[i] == null; ++i) {
        config._a[i] = input[i] = currentDate[i];
    }

    // Zero out whatever was not defaulted, including time
    for (; i < 7; i++) {
        config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
    }

    // Check for 24:00:00.000
    if (config._a[HOUR] === 24 &&
            config._a[MINUTE] === 0 &&
            config._a[SECOND] === 0 &&
            config._a[MILLISECOND] === 0) {
        config._nextDay = true;
        config._a[HOUR] = 0;
    }

    config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
    // Apply timezone offset from input. The actual utcOffset can be changed
    // with parseZone.
    if (config._tzm != null) {
        config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
    }

    if (config._nextDay) {
        config._a[HOUR] = 24;
    }
}

function dayOfYearFromWeekInfo(config) {
    var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

    w = config._w;
    if (w.GG != null || w.W != null || w.E != null) {
        dow = 1;
        doy = 4;

        // TODO: We need to take the current isoWeekYear, but that depends on
        // how we interpret now (local, utc, fixed offset). So create
        // a now version of current config (take local/utc/offset flags, and
        // create now).
        weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
        week = defaults(w.W, 1);
        weekday = defaults(w.E, 1);
        if (weekday < 1 || weekday > 7) {
            weekdayOverflow = true;
        }
    } else {
        dow = config._locale._week.dow;
        doy = config._locale._week.doy;

        var curWeek = weekOfYear(createLocal(), dow, doy);

        weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

        // Default to current week.
        week = defaults(w.w, curWeek.week);

        if (w.d != null) {
            // weekday -- low day numbers are considered next week
            weekday = w.d;
            if (weekday < 0 || weekday > 6) {
                weekdayOverflow = true;
            }
        } else if (w.e != null) {
            // local weekday -- counting starts from begining of week
            weekday = w.e + dow;
            if (w.e < 0 || w.e > 6) {
                weekdayOverflow = true;
            }
        } else {
            // default to begining of week
            weekday = dow;
        }
    }
    if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
        getParsingFlags(config)._overflowWeeks = true;
    } else if (weekdayOverflow != null) {
        getParsingFlags(config)._overflowWeekday = true;
    } else {
        temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }
}

// constant that refers to the ISO standard
hooks.ISO_8601 = function () {};

// constant that refers to the RFC 2822 form
hooks.RFC_2822 = function () {};

// date from string and format string
function configFromStringAndFormat(config) {
    // TODO: Move this to another part of the creation flow to prevent circular deps
    if (config._f === hooks.ISO_8601) {
        configFromISO(config);
        return;
    }
    if (config._f === hooks.RFC_2822) {
        configFromRFC2822(config);
        return;
    }
    config._a = [];
    getParsingFlags(config).empty = true;

    // This array is used to make a Date, either with `new Date` or `Date.UTC`
    var string = '' + config._i,
        i, parsedInput, tokens, token, skipped,
        stringLength = string.length,
        totalParsedInputLength = 0;

    tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

    for (i = 0; i < tokens.length; i++) {
        token = tokens[i];
        parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
        // console.log('token', token, 'parsedInput', parsedInput,
        //         'regex', getParseRegexForToken(token, config));
        if (parsedInput) {
            skipped = string.substr(0, string.indexOf(parsedInput));
            if (skipped.length > 0) {
                getParsingFlags(config).unusedInput.push(skipped);
            }
            string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
            totalParsedInputLength += parsedInput.length;
        }
        // don't parse if it's not a known token
        if (formatTokenFunctions[token]) {
            if (parsedInput) {
                getParsingFlags(config).empty = false;
            }
            else {
                getParsingFlags(config).unusedTokens.push(token);
            }
            addTimeToArrayFromToken(token, parsedInput, config);
        }
        else if (config._strict && !parsedInput) {
            getParsingFlags(config).unusedTokens.push(token);
        }
    }

    // add remaining unparsed input length to the string
    getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
    if (string.length > 0) {
        getParsingFlags(config).unusedInput.push(string);
    }

    // clear _12h flag if hour is <= 12
    if (config._a[HOUR] <= 12 &&
        getParsingFlags(config).bigHour === true &&
        config._a[HOUR] > 0) {
        getParsingFlags(config).bigHour = undefined;
    }

    getParsingFlags(config).parsedDateParts = config._a.slice(0);
    getParsingFlags(config).meridiem = config._meridiem;
    // handle meridiem
    config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

    configFromArray(config);
    checkOverflow(config);
}


function meridiemFixWrap (locale, hour, meridiem) {
    var isPm;

    if (meridiem == null) {
        // nothing to do
        return hour;
    }
    if (locale.meridiemHour != null) {
        return locale.meridiemHour(hour, meridiem);
    } else if (locale.isPM != null) {
        // Fallback
        isPm = locale.isPM(meridiem);
        if (isPm && hour < 12) {
            hour += 12;
        }
        if (!isPm && hour === 12) {
            hour = 0;
        }
        return hour;
    } else {
        // this is not supposed to happen
        return hour;
    }
}

// date from string and array of format strings
function configFromStringAndArray(config) {
    var tempConfig,
        bestMoment,

        scoreToBeat,
        i,
        currentScore;

    if (config._f.length === 0) {
        getParsingFlags(config).invalidFormat = true;
        config._d = new Date(NaN);
        return;
    }

    for (i = 0; i < config._f.length; i++) {
        currentScore = 0;
        tempConfig = copyConfig({}, config);
        if (config._useUTC != null) {
            tempConfig._useUTC = config._useUTC;
        }
        tempConfig._f = config._f[i];
        configFromStringAndFormat(tempConfig);

        if (!isValid(tempConfig)) {
            continue;
        }

        // if there is any input that was not parsed add a penalty for that format
        currentScore += getParsingFlags(tempConfig).charsLeftOver;

        //or tokens
        currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

        getParsingFlags(tempConfig).score = currentScore;

        if (scoreToBeat == null || currentScore < scoreToBeat) {
            scoreToBeat = currentScore;
            bestMoment = tempConfig;
        }
    }

    extend(config, bestMoment || tempConfig);
}

function configFromObject(config) {
    if (config._d) {
        return;
    }

    var i = normalizeObjectUnits(config._i);
    config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
        return obj && parseInt(obj, 10);
    });

    configFromArray(config);
}

function createFromConfig (config) {
    var res = new Moment(checkOverflow(prepareConfig(config)));
    if (res._nextDay) {
        // Adding is smart enough around DST
        res.add(1, 'd');
        res._nextDay = undefined;
    }

    return res;
}

function prepareConfig (config) {
    var input = config._i,
        format = config._f;

    config._locale = config._locale || getLocale(config._l);

    if (input === null || (format === undefined && input === '')) {
        return createInvalid({nullInput: true});
    }

    if (typeof input === 'string') {
        config._i = input = config._locale.preparse(input);
    }

    if (isMoment(input)) {
        return new Moment(checkOverflow(input));
    } else if (isDate(input)) {
        config._d = input;
    } else if (isArray(format)) {
        configFromStringAndArray(config);
    } else if (format) {
        configFromStringAndFormat(config);
    }  else {
        configFromInput(config);
    }

    if (!isValid(config)) {
        config._d = null;
    }

    return config;
}

function configFromInput(config) {
    var input = config._i;
    if (isUndefined(input)) {
        config._d = new Date(hooks.now());
    } else if (isDate(input)) {
        config._d = new Date(input.valueOf());
    } else if (typeof input === 'string') {
        configFromString(config);
    } else if (isArray(input)) {
        config._a = map(input.slice(0), function (obj) {
            return parseInt(obj, 10);
        });
        configFromArray(config);
    } else if (isObject(input)) {
        configFromObject(config);
    } else if (isNumber(input)) {
        // from milliseconds
        config._d = new Date(input);
    } else {
        hooks.createFromInputFallback(config);
    }
}

function createLocalOrUTC (input, format, locale, strict, isUTC) {
    var c = {};

    if (locale === true || locale === false) {
        strict = locale;
        locale = undefined;
    }

    if ((isObject(input) && isObjectEmpty(input)) ||
            (isArray(input) && input.length === 0)) {
        input = undefined;
    }
    // object construction must be done this way.
    // https://github.com/moment/moment/issues/1423
    c._isAMomentObject = true;
    c._useUTC = c._isUTC = isUTC;
    c._l = locale;
    c._i = input;
    c._f = format;
    c._strict = strict;

    return createFromConfig(c);
}

function createLocal (input, format, locale, strict) {
    return createLocalOrUTC(input, format, locale, strict, false);
}

var prototypeMin = deprecate(
    'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
    function () {
        var other = createLocal.apply(null, arguments);
        if (this.isValid() && other.isValid()) {
            return other < this ? this : other;
        } else {
            return createInvalid();
        }
    }
);

var prototypeMax = deprecate(
    'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
    function () {
        var other = createLocal.apply(null, arguments);
        if (this.isValid() && other.isValid()) {
            return other > this ? this : other;
        } else {
            return createInvalid();
        }
    }
);

// Pick a moment m from moments so that m[fn](other) is true for all
// other. This relies on the function fn to be transitive.
//
// moments should either be an array of moment objects or an array, whose
// first element is an array of moment objects.
function pickBy(fn, moments) {
    var res, i;
    if (moments.length === 1 && isArray(moments[0])) {
        moments = moments[0];
    }
    if (!moments.length) {
        return createLocal();
    }
    res = moments[0];
    for (i = 1; i < moments.length; ++i) {
        if (!moments[i].isValid() || moments[i][fn](res)) {
            res = moments[i];
        }
    }
    return res;
}

// TODO: Use [].sort instead?
function min () {
    var args = [].slice.call(arguments, 0);

    return pickBy('isBefore', args);
}

function max () {
    var args = [].slice.call(arguments, 0);

    return pickBy('isAfter', args);
}

var now = function () {
    return Date.now ? Date.now() : +(new Date());
};

var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

function isDurationValid(m) {
    for (var key in m) {
        if (!(ordering.indexOf(key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
            return false;
        }
    }

    var unitHasDecimal = false;
    for (var i = 0; i < ordering.length; ++i) {
        if (m[ordering[i]]) {
            if (unitHasDecimal) {
                return false; // only allow non-integers for smallest unit
            }
            if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                unitHasDecimal = true;
            }
        }
    }

    return true;
}

function isValid$1() {
    return this._isValid;
}

function createInvalid$1() {
    return createDuration(NaN);
}

function Duration (duration) {
    var normalizedInput = normalizeObjectUnits(duration),
        years = normalizedInput.year || 0,
        quarters = normalizedInput.quarter || 0,
        months = normalizedInput.month || 0,
        weeks = normalizedInput.week || 0,
        days = normalizedInput.day || 0,
        hours = normalizedInput.hour || 0,
        minutes = normalizedInput.minute || 0,
        seconds = normalizedInput.second || 0,
        milliseconds = normalizedInput.millisecond || 0;

    this._isValid = isDurationValid(normalizedInput);

    // representation for dateAddRemove
    this._milliseconds = +milliseconds +
        seconds * 1e3 + // 1000
        minutes * 6e4 + // 1000 * 60
        hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
    // Because of dateAddRemove treats 24 hours as different from a
    // day when working around DST, we need to store them separately
    this._days = +days +
        weeks * 7;
    // It is impossible translate months into days without knowing
    // which months you are are talking about, so we have to store
    // it separately.
    this._months = +months +
        quarters * 3 +
        years * 12;

    this._data = {};

    this._locale = getLocale();

    this._bubble();
}

function isDuration (obj) {
    return obj instanceof Duration;
}

function absRound (number) {
    if (number < 0) {
        return Math.round(-1 * number) * -1;
    } else {
        return Math.round(number);
    }
}

// FORMATTING

function offset (token, separator) {
    addFormatToken(token, 0, 0, function () {
        var offset = this.utcOffset();
        var sign = '+';
        if (offset < 0) {
            offset = -offset;
            sign = '-';
        }
        return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
    });
}

offset('Z', ':');
offset('ZZ', '');

// PARSING

addRegexToken('Z',  matchShortOffset);
addRegexToken('ZZ', matchShortOffset);
addParseToken(['Z', 'ZZ'], function (input, array, config) {
    config._useUTC = true;
    config._tzm = offsetFromString(matchShortOffset, input);
});

// HELPERS

// timezone chunker
// '+10:00' > ['10',  '00']
// '-1530'  > ['-15', '30']
var chunkOffset = /([\+\-]|\d\d)/gi;

function offsetFromString(matcher, string) {
    var matches = (string || '').match(matcher);

    if (matches === null) {
        return null;
    }

    var chunk   = matches[matches.length - 1] || [];
    var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
    var minutes = +(parts[1] * 60) + toInt(parts[2]);

    return minutes === 0 ?
      0 :
      parts[0] === '+' ? minutes : -minutes;
}

// Return a moment from input, that is local/utc/zone equivalent to model.
function cloneWithOffset(input, model) {
    var res, diff;
    if (model._isUTC) {
        res = model.clone();
        diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
        // Use low-level api, because this fn is low-level api.
        res._d.setTime(res._d.valueOf() + diff);
        hooks.updateOffset(res, false);
        return res;
    } else {
        return createLocal(input).local();
    }
}

function getDateOffset (m) {
    // On Firefox.24 Date#getTimezoneOffset returns a floating point.
    // https://github.com/moment/moment/pull/1871
    return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
}

// HOOKS

// This function will be called whenever a moment is mutated.
// It is intended to keep the offset in sync with the timezone.
hooks.updateOffset = function () {};

// MOMENTS

// keepLocalTime = true means only change the timezone, without
// affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
// 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
// +0200, so we adjust the time as needed, to be valid.
//
// Keeping the time actually adds/subtracts (one hour)
// from the actual represented time. That is why we call updateOffset
// a second time. In case it wants us to change the offset again
// _changeInProgress == true case, then we have to adjust, because
// there is no such time in the given timezone.
function getSetOffset (input, keepLocalTime, keepMinutes) {
    var offset = this._offset || 0,
        localAdjust;
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    if (input != null) {
        if (typeof input === 'string') {
            input = offsetFromString(matchShortOffset, input);
            if (input === null) {
                return this;
            }
        } else if (Math.abs(input) < 16 && !keepMinutes) {
            input = input * 60;
        }
        if (!this._isUTC && keepLocalTime) {
            localAdjust = getDateOffset(this);
        }
        this._offset = input;
        this._isUTC = true;
        if (localAdjust != null) {
            this.add(localAdjust, 'm');
        }
        if (offset !== input) {
            if (!keepLocalTime || this._changeInProgress) {
                addSubtract(this, createDuration(input - offset, 'm'), 1, false);
            } else if (!this._changeInProgress) {
                this._changeInProgress = true;
                hooks.updateOffset(this, true);
                this._changeInProgress = null;
            }
        }
        return this;
    } else {
        return this._isUTC ? offset : getDateOffset(this);
    }
}

function getSetZone (input, keepLocalTime) {
    if (input != null) {
        if (typeof input !== 'string') {
            input = -input;
        }

        this.utcOffset(input, keepLocalTime);

        return this;
    } else {
        return -this.utcOffset();
    }
}

function setOffsetToUTC (keepLocalTime) {
    return this.utcOffset(0, keepLocalTime);
}

function setOffsetToLocal (keepLocalTime) {
    if (this._isUTC) {
        this.utcOffset(0, keepLocalTime);
        this._isUTC = false;

        if (keepLocalTime) {
            this.subtract(getDateOffset(this), 'm');
        }
    }
    return this;
}

function setOffsetToParsedOffset () {
    if (this._tzm != null) {
        this.utcOffset(this._tzm, false, true);
    } else if (typeof this._i === 'string') {
        var tZone = offsetFromString(matchOffset, this._i);
        if (tZone != null) {
            this.utcOffset(tZone);
        }
        else {
            this.utcOffset(0, true);
        }
    }
    return this;
}

function hasAlignedHourOffset (input) {
    if (!this.isValid()) {
        return false;
    }
    input = input ? createLocal(input).utcOffset() : 0;

    return (this.utcOffset() - input) % 60 === 0;
}

function isDaylightSavingTime () {
    return (
        this.utcOffset() > this.clone().month(0).utcOffset() ||
        this.utcOffset() > this.clone().month(5).utcOffset()
    );
}

function isDaylightSavingTimeShifted () {
    if (!isUndefined(this._isDSTShifted)) {
        return this._isDSTShifted;
    }

    var c = {};

    copyConfig(c, this);
    c = prepareConfig(c);

    if (c._a) {
        var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
        this._isDSTShifted = this.isValid() &&
            compareArrays(c._a, other.toArray()) > 0;
    } else {
        this._isDSTShifted = false;
    }

    return this._isDSTShifted;
}

function isLocal () {
    return this.isValid() ? !this._isUTC : false;
}

function isUtcOffset () {
    return this.isValid() ? this._isUTC : false;
}

function isUtc () {
    return this.isValid() ? this._isUTC && this._offset === 0 : false;
}

// ASP.NET json date format regex
var aspNetRegex = /^(\-)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

// from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
// somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
// and further modified to allow for strings containing both week and day
var isoRegex = /^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/;

function createDuration (input, key) {
    var duration = input,
        // matching against regexp is expensive, do it on demand
        match = null,
        sign,
        ret,
        diffRes;

    if (isDuration(input)) {
        duration = {
            ms : input._milliseconds,
            d  : input._days,
            M  : input._months
        };
    } else if (isNumber(input)) {
        duration = {};
        if (key) {
            duration[key] = input;
        } else {
            duration.milliseconds = input;
        }
    } else if (!!(match = aspNetRegex.exec(input))) {
        sign = (match[1] === '-') ? -1 : 1;
        duration = {
            y  : 0,
            d  : toInt(match[DATE])                         * sign,
            h  : toInt(match[HOUR])                         * sign,
            m  : toInt(match[MINUTE])                       * sign,
            s  : toInt(match[SECOND])                       * sign,
            ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
        };
    } else if (!!(match = isoRegex.exec(input))) {
        sign = (match[1] === '-') ? -1 : 1;
        duration = {
            y : parseIso(match[2], sign),
            M : parseIso(match[3], sign),
            w : parseIso(match[4], sign),
            d : parseIso(match[5], sign),
            h : parseIso(match[6], sign),
            m : parseIso(match[7], sign),
            s : parseIso(match[8], sign)
        };
    } else if (duration == null) {// checks for null or undefined
        duration = {};
    } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
        diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

        duration = {};
        duration.ms = diffRes.milliseconds;
        duration.M = diffRes.months;
    }

    ret = new Duration(duration);

    if (isDuration(input) && hasOwnProp(input, '_locale')) {
        ret._locale = input._locale;
    }

    return ret;
}

createDuration.fn = Duration.prototype;
createDuration.invalid = createInvalid$1;

function parseIso (inp, sign) {
    // We'd normally use ~~inp for this, but unfortunately it also
    // converts floats to ints.
    // inp may be undefined, so careful calling replace on it.
    var res = inp && parseFloat(inp.replace(',', '.'));
    // apply sign while we're at it
    return (isNaN(res) ? 0 : res) * sign;
}

function positiveMomentsDifference(base, other) {
    var res = {milliseconds: 0, months: 0};

    res.months = other.month() - base.month() +
        (other.year() - base.year()) * 12;
    if (base.clone().add(res.months, 'M').isAfter(other)) {
        --res.months;
    }

    res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

    return res;
}

function momentsDifference(base, other) {
    var res;
    if (!(base.isValid() && other.isValid())) {
        return {milliseconds: 0, months: 0};
    }

    other = cloneWithOffset(other, base);
    if (base.isBefore(other)) {
        res = positiveMomentsDifference(base, other);
    } else {
        res = positiveMomentsDifference(other, base);
        res.milliseconds = -res.milliseconds;
        res.months = -res.months;
    }

    return res;
}

// TODO: remove 'name' arg after deprecation is removed
function createAdder(direction, name) {
    return function (val, period) {
        var dur, tmp;
        //invert the arguments, but complain about it
        if (period !== null && !isNaN(+period)) {
            deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
            'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
            tmp = val; val = period; period = tmp;
        }

        val = typeof val === 'string' ? +val : val;
        dur = createDuration(val, period);
        addSubtract(this, dur, direction);
        return this;
    };
}

function addSubtract (mom, duration, isAdding, updateOffset) {
    var milliseconds = duration._milliseconds,
        days = absRound(duration._days),
        months = absRound(duration._months);

    if (!mom.isValid()) {
        // No op
        return;
    }

    updateOffset = updateOffset == null ? true : updateOffset;

    if (milliseconds) {
        mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
    }
    if (days) {
        set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
    }
    if (months) {
        setMonth(mom, get(mom, 'Month') + months * isAdding);
    }
    if (updateOffset) {
        hooks.updateOffset(mom, days || months);
    }
}

var add      = createAdder(1, 'add');
var subtract = createAdder(-1, 'subtract');

function getCalendarFormat(myMoment, now) {
    var diff = myMoment.diff(now, 'days', true);
    return diff < -6 ? 'sameElse' :
            diff < -1 ? 'lastWeek' :
            diff < 0 ? 'lastDay' :
            diff < 1 ? 'sameDay' :
            diff < 2 ? 'nextDay' :
            diff < 7 ? 'nextWeek' : 'sameElse';
}

function calendar$1 (time, formats) {
    // We want to compare the start of today, vs this.
    // Getting start-of-today depends on whether we're local/utc/offset or not.
    var now = time || createLocal(),
        sod = cloneWithOffset(now, this).startOf('day'),
        format = hooks.calendarFormat(this, sod) || 'sameElse';

    var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

    return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
}

function clone () {
    return new Moment(this);
}

function isAfter (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input);
    if (!(this.isValid() && localInput.isValid())) {
        return false;
    }
    units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
    if (units === 'millisecond') {
        return this.valueOf() > localInput.valueOf();
    } else {
        return localInput.valueOf() < this.clone().startOf(units).valueOf();
    }
}

function isBefore (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input);
    if (!(this.isValid() && localInput.isValid())) {
        return false;
    }
    units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
    if (units === 'millisecond') {
        return this.valueOf() < localInput.valueOf();
    } else {
        return this.clone().endOf(units).valueOf() < localInput.valueOf();
    }
}

function isBetween (from, to, units, inclusivity) {
    inclusivity = inclusivity || '()';
    return (inclusivity[0] === '(' ? this.isAfter(from, units) : !this.isBefore(from, units)) &&
        (inclusivity[1] === ')' ? this.isBefore(to, units) : !this.isAfter(to, units));
}

function isSame (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input),
        inputMs;
    if (!(this.isValid() && localInput.isValid())) {
        return false;
    }
    units = normalizeUnits(units || 'millisecond');
    if (units === 'millisecond') {
        return this.valueOf() === localInput.valueOf();
    } else {
        inputMs = localInput.valueOf();
        return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
    }
}

function isSameOrAfter (input, units) {
    return this.isSame(input, units) || this.isAfter(input,units);
}

function isSameOrBefore (input, units) {
    return this.isSame(input, units) || this.isBefore(input,units);
}

function diff (input, units, asFloat) {
    var that,
        zoneDelta,
        delta, output;

    if (!this.isValid()) {
        return NaN;
    }

    that = cloneWithOffset(input, this);

    if (!that.isValid()) {
        return NaN;
    }

    zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

    units = normalizeUnits(units);

    if (units === 'year' || units === 'month' || units === 'quarter') {
        output = monthDiff(this, that);
        if (units === 'quarter') {
            output = output / 3;
        } else if (units === 'year') {
            output = output / 12;
        }
    } else {
        delta = this - that;
        output = units === 'second' ? delta / 1e3 : // 1000
            units === 'minute' ? delta / 6e4 : // 1000 * 60
            units === 'hour' ? delta / 36e5 : // 1000 * 60 * 60
            units === 'day' ? (delta - zoneDelta) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
            units === 'week' ? (delta - zoneDelta) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
            delta;
    }
    return asFloat ? output : absFloor(output);
}

function monthDiff (a, b) {
    // difference in months
    var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
        // b is in (anchor - 1 month, anchor + 1 month)
        anchor = a.clone().add(wholeMonthDiff, 'months'),
        anchor2, adjust;

    if (b - anchor < 0) {
        anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
        // linear across the month
        adjust = (b - anchor) / (anchor - anchor2);
    } else {
        anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
        // linear across the month
        adjust = (b - anchor) / (anchor2 - anchor);
    }

    //check for negative zero, return zero if negative zero
    return -(wholeMonthDiff + adjust) || 0;
}

hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

function toString () {
    return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
}

function toISOString() {
    if (!this.isValid()) {
        return null;
    }
    var m = this.clone().utc();
    if (m.year() < 0 || m.year() > 9999) {
        return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
    }
    if (isFunction(Date.prototype.toISOString)) {
        // native implementation is ~50x faster, use it when we can
        return this.toDate().toISOString();
    }
    return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
}

/**
 * Return a human readable representation of a moment that can
 * also be evaluated to get a new moment which is the same
 *
 * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
 */
function inspect () {
    if (!this.isValid()) {
        return 'moment.invalid(/* ' + this._i + ' */)';
    }
    var func = 'moment';
    var zone = '';
    if (!this.isLocal()) {
        func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
        zone = 'Z';
    }
    var prefix = '[' + func + '("]';
    var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
    var datetime = '-MM-DD[T]HH:mm:ss.SSS';
    var suffix = zone + '[")]';

    return this.format(prefix + year + datetime + suffix);
}

function format (inputString) {
    if (!inputString) {
        inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
    }
    var output = formatMoment(this, inputString);
    return this.localeData().postformat(output);
}

function from (time, withoutSuffix) {
    if (this.isValid() &&
            ((isMoment(time) && time.isValid()) ||
             createLocal(time).isValid())) {
        return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
    } else {
        return this.localeData().invalidDate();
    }
}

function fromNow (withoutSuffix) {
    return this.from(createLocal(), withoutSuffix);
}

function to (time, withoutSuffix) {
    if (this.isValid() &&
            ((isMoment(time) && time.isValid()) ||
             createLocal(time).isValid())) {
        return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
    } else {
        return this.localeData().invalidDate();
    }
}

function toNow (withoutSuffix) {
    return this.to(createLocal(), withoutSuffix);
}

// If passed a locale key, it will set the locale for this
// instance.  Otherwise, it will return the locale configuration
// variables for this instance.
function locale (key) {
    var newLocaleData;

    if (key === undefined) {
        return this._locale._abbr;
    } else {
        newLocaleData = getLocale(key);
        if (newLocaleData != null) {
            this._locale = newLocaleData;
        }
        return this;
    }
}

var lang = deprecate(
    'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
    function (key) {
        if (key === undefined) {
            return this.localeData();
        } else {
            return this.locale(key);
        }
    }
);

function localeData () {
    return this._locale;
}

function startOf (units) {
    units = normalizeUnits(units);
    // the following switch intentionally omits break keywords
    // to utilize falling through the cases.
    switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
        case 'date':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
    }

    // weeks are a special case
    if (units === 'week') {
        this.weekday(0);
    }
    if (units === 'isoWeek') {
        this.isoWeekday(1);
    }

    // quarters are also special
    if (units === 'quarter') {
        this.month(Math.floor(this.month() / 3) * 3);
    }

    return this;
}

function endOf (units) {
    units = normalizeUnits(units);
    if (units === undefined || units === 'millisecond') {
        return this;
    }

    // 'date' is an alias for 'day', so it should be considered as such.
    if (units === 'date') {
        units = 'day';
    }

    return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
}

function valueOf () {
    return this._d.valueOf() - ((this._offset || 0) * 60000);
}

function unix () {
    return Math.floor(this.valueOf() / 1000);
}

function toDate () {
    return new Date(this.valueOf());
}

function toArray () {
    var m = this;
    return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
}

function toObject () {
    var m = this;
    return {
        years: m.year(),
        months: m.month(),
        date: m.date(),
        hours: m.hours(),
        minutes: m.minutes(),
        seconds: m.seconds(),
        milliseconds: m.milliseconds()
    };
}

function toJSON () {
    // new Date(NaN).toJSON() === null
    return this.isValid() ? this.toISOString() : null;
}

function isValid$2 () {
    return isValid(this);
}

function parsingFlags () {
    return extend({}, getParsingFlags(this));
}

function invalidAt () {
    return getParsingFlags(this).overflow;
}

function creationData() {
    return {
        input: this._i,
        format: this._f,
        locale: this._locale,
        isUTC: this._isUTC,
        strict: this._strict
    };
}

// FORMATTING

addFormatToken(0, ['gg', 2], 0, function () {
    return this.weekYear() % 100;
});

addFormatToken(0, ['GG', 2], 0, function () {
    return this.isoWeekYear() % 100;
});

function addWeekYearFormatToken (token, getter) {
    addFormatToken(0, [token, token.length], 0, getter);
}

addWeekYearFormatToken('gggg',     'weekYear');
addWeekYearFormatToken('ggggg',    'weekYear');
addWeekYearFormatToken('GGGG',  'isoWeekYear');
addWeekYearFormatToken('GGGGG', 'isoWeekYear');

// ALIASES

addUnitAlias('weekYear', 'gg');
addUnitAlias('isoWeekYear', 'GG');

// PRIORITY

addUnitPriority('weekYear', 1);
addUnitPriority('isoWeekYear', 1);


// PARSING

addRegexToken('G',      matchSigned);
addRegexToken('g',      matchSigned);
addRegexToken('GG',     match1to2, match2);
addRegexToken('gg',     match1to2, match2);
addRegexToken('GGGG',   match1to4, match4);
addRegexToken('gggg',   match1to4, match4);
addRegexToken('GGGGG',  match1to6, match6);
addRegexToken('ggggg',  match1to6, match6);

addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
    week[token.substr(0, 2)] = toInt(input);
});

addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
    week[token] = hooks.parseTwoDigitYear(input);
});

// MOMENTS

function getSetWeekYear (input) {
    return getSetWeekYearHelper.call(this,
            input,
            this.week(),
            this.weekday(),
            this.localeData()._week.dow,
            this.localeData()._week.doy);
}

function getSetISOWeekYear (input) {
    return getSetWeekYearHelper.call(this,
            input, this.isoWeek(), this.isoWeekday(), 1, 4);
}

function getISOWeeksInYear () {
    return weeksInYear(this.year(), 1, 4);
}

function getWeeksInYear () {
    var weekInfo = this.localeData()._week;
    return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
}

function getSetWeekYearHelper(input, week, weekday, dow, doy) {
    var weeksTarget;
    if (input == null) {
        return weekOfYear(this, dow, doy).year;
    } else {
        weeksTarget = weeksInYear(input, dow, doy);
        if (week > weeksTarget) {
            week = weeksTarget;
        }
        return setWeekAll.call(this, input, week, weekday, dow, doy);
    }
}

function setWeekAll(weekYear, week, weekday, dow, doy) {
    var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
        date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

    this.year(date.getUTCFullYear());
    this.month(date.getUTCMonth());
    this.date(date.getUTCDate());
    return this;
}

// FORMATTING

addFormatToken('Q', 0, 'Qo', 'quarter');

// ALIASES

addUnitAlias('quarter', 'Q');

// PRIORITY

addUnitPriority('quarter', 7);

// PARSING

addRegexToken('Q', match1);
addParseToken('Q', function (input, array) {
    array[MONTH] = (toInt(input) - 1) * 3;
});

// MOMENTS

function getSetQuarter (input) {
    return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
}

// FORMATTING

addFormatToken('D', ['DD', 2], 'Do', 'date');

// ALIASES

addUnitAlias('date', 'D');

// PRIOROITY
addUnitPriority('date', 9);

// PARSING

addRegexToken('D',  match1to2);
addRegexToken('DD', match1to2, match2);
addRegexToken('Do', function (isStrict, locale) {
    // TODO: Remove "ordinalParse" fallback in next major release.
    return isStrict ?
      (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
      locale._dayOfMonthOrdinalParseLenient;
});

addParseToken(['D', 'DD'], DATE);
addParseToken('Do', function (input, array) {
    array[DATE] = toInt(input.match(match1to2)[0], 10);
});

// MOMENTS

var getSetDayOfMonth = makeGetSet('Date', true);

// FORMATTING

addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

// ALIASES

addUnitAlias('dayOfYear', 'DDD');

// PRIORITY
addUnitPriority('dayOfYear', 4);

// PARSING

addRegexToken('DDD',  match1to3);
addRegexToken('DDDD', match3);
addParseToken(['DDD', 'DDDD'], function (input, array, config) {
    config._dayOfYear = toInt(input);
});

// HELPERS

// MOMENTS

function getSetDayOfYear (input) {
    var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
    return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
}

// FORMATTING

addFormatToken('m', ['mm', 2], 0, 'minute');

// ALIASES

addUnitAlias('minute', 'm');

// PRIORITY

addUnitPriority('minute', 14);

// PARSING

addRegexToken('m',  match1to2);
addRegexToken('mm', match1to2, match2);
addParseToken(['m', 'mm'], MINUTE);

// MOMENTS

var getSetMinute = makeGetSet('Minutes', false);

// FORMATTING

addFormatToken('s', ['ss', 2], 0, 'second');

// ALIASES

addUnitAlias('second', 's');

// PRIORITY

addUnitPriority('second', 15);

// PARSING

addRegexToken('s',  match1to2);
addRegexToken('ss', match1to2, match2);
addParseToken(['s', 'ss'], SECOND);

// MOMENTS

var getSetSecond = makeGetSet('Seconds', false);

// FORMATTING

addFormatToken('S', 0, 0, function () {
    return ~~(this.millisecond() / 100);
});

addFormatToken(0, ['SS', 2], 0, function () {
    return ~~(this.millisecond() / 10);
});

addFormatToken(0, ['SSS', 3], 0, 'millisecond');
addFormatToken(0, ['SSSS', 4], 0, function () {
    return this.millisecond() * 10;
});
addFormatToken(0, ['SSSSS', 5], 0, function () {
    return this.millisecond() * 100;
});
addFormatToken(0, ['SSSSSS', 6], 0, function () {
    return this.millisecond() * 1000;
});
addFormatToken(0, ['SSSSSSS', 7], 0, function () {
    return this.millisecond() * 10000;
});
addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
    return this.millisecond() * 100000;
});
addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
    return this.millisecond() * 1000000;
});


// ALIASES

addUnitAlias('millisecond', 'ms');

// PRIORITY

addUnitPriority('millisecond', 16);

// PARSING

addRegexToken('S',    match1to3, match1);
addRegexToken('SS',   match1to3, match2);
addRegexToken('SSS',  match1to3, match3);

var token;
for (token = 'SSSS'; token.length <= 9; token += 'S') {
    addRegexToken(token, matchUnsigned);
}

function parseMs(input, array) {
    array[MILLISECOND] = toInt(('0.' + input) * 1000);
}

for (token = 'S'; token.length <= 9; token += 'S') {
    addParseToken(token, parseMs);
}
// MOMENTS

var getSetMillisecond = makeGetSet('Milliseconds', false);

// FORMATTING

addFormatToken('z',  0, 0, 'zoneAbbr');
addFormatToken('zz', 0, 0, 'zoneName');

// MOMENTS

function getZoneAbbr () {
    return this._isUTC ? 'UTC' : '';
}

function getZoneName () {
    return this._isUTC ? 'Coordinated Universal Time' : '';
}

var proto = Moment.prototype;

proto.add               = add;
proto.calendar          = calendar$1;
proto.clone             = clone;
proto.diff              = diff;
proto.endOf             = endOf;
proto.format            = format;
proto.from              = from;
proto.fromNow           = fromNow;
proto.to                = to;
proto.toNow             = toNow;
proto.get               = stringGet;
proto.invalidAt         = invalidAt;
proto.isAfter           = isAfter;
proto.isBefore          = isBefore;
proto.isBetween         = isBetween;
proto.isSame            = isSame;
proto.isSameOrAfter     = isSameOrAfter;
proto.isSameOrBefore    = isSameOrBefore;
proto.isValid           = isValid$2;
proto.lang              = lang;
proto.locale            = locale;
proto.localeData        = localeData;
proto.max               = prototypeMax;
proto.min               = prototypeMin;
proto.parsingFlags      = parsingFlags;
proto.set               = stringSet;
proto.startOf           = startOf;
proto.subtract          = subtract;
proto.toArray           = toArray;
proto.toObject          = toObject;
proto.toDate            = toDate;
proto.toISOString       = toISOString;
proto.inspect           = inspect;
proto.toJSON            = toJSON;
proto.toString          = toString;
proto.unix              = unix;
proto.valueOf           = valueOf;
proto.creationData      = creationData;

// Year
proto.year       = getSetYear;
proto.isLeapYear = getIsLeapYear;

// Week Year
proto.weekYear    = getSetWeekYear;
proto.isoWeekYear = getSetISOWeekYear;

// Quarter
proto.quarter = proto.quarters = getSetQuarter;

// Month
proto.month       = getSetMonth;
proto.daysInMonth = getDaysInMonth;

// Week
proto.week           = proto.weeks        = getSetWeek;
proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
proto.weeksInYear    = getWeeksInYear;
proto.isoWeeksInYear = getISOWeeksInYear;

// Day
proto.date       = getSetDayOfMonth;
proto.day        = proto.days             = getSetDayOfWeek;
proto.weekday    = getSetLocaleDayOfWeek;
proto.isoWeekday = getSetISODayOfWeek;
proto.dayOfYear  = getSetDayOfYear;

// Hour
proto.hour = proto.hours = getSetHour;

// Minute
proto.minute = proto.minutes = getSetMinute;

// Second
proto.second = proto.seconds = getSetSecond;

// Millisecond
proto.millisecond = proto.milliseconds = getSetMillisecond;

// Offset
proto.utcOffset            = getSetOffset;
proto.utc                  = setOffsetToUTC;
proto.local                = setOffsetToLocal;
proto.parseZone            = setOffsetToParsedOffset;
proto.hasAlignedHourOffset = hasAlignedHourOffset;
proto.isDST                = isDaylightSavingTime;
proto.isLocal              = isLocal;
proto.isUtcOffset          = isUtcOffset;
proto.isUtc                = isUtc;
proto.isUTC                = isUtc;

// Timezone
proto.zoneAbbr = getZoneAbbr;
proto.zoneName = getZoneName;

// Deprecations
proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

function createUnix (input) {
    return createLocal(input * 1000);
}

function createInZone () {
    return createLocal.apply(null, arguments).parseZone();
}

function preParsePostFormat (string) {
    return string;
}

var proto$1 = Locale.prototype;

proto$1.calendar        = calendar;
proto$1.longDateFormat  = longDateFormat;
proto$1.invalidDate     = invalidDate;
proto$1.ordinal         = ordinal;
proto$1.preparse        = preParsePostFormat;
proto$1.postformat      = preParsePostFormat;
proto$1.relativeTime    = relativeTime;
proto$1.pastFuture      = pastFuture;
proto$1.set             = set;

// Month
proto$1.months            =        localeMonths;
proto$1.monthsShort       =        localeMonthsShort;
proto$1.monthsParse       =        localeMonthsParse;
proto$1.monthsRegex       = monthsRegex;
proto$1.monthsShortRegex  = monthsShortRegex;

// Week
proto$1.week = localeWeek;
proto$1.firstDayOfYear = localeFirstDayOfYear;
proto$1.firstDayOfWeek = localeFirstDayOfWeek;

// Day of Week
proto$1.weekdays       =        localeWeekdays;
proto$1.weekdaysMin    =        localeWeekdaysMin;
proto$1.weekdaysShort  =        localeWeekdaysShort;
proto$1.weekdaysParse  =        localeWeekdaysParse;

proto$1.weekdaysRegex       =        weekdaysRegex;
proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

// Hours
proto$1.isPM = localeIsPM;
proto$1.meridiem = localeMeridiem;

function get$1 (format, index, field, setter) {
    var locale = getLocale();
    var utc = createUTC().set(setter, index);
    return locale[field](utc, format);
}

function listMonthsImpl (format, index, field) {
    if (isNumber(format)) {
        index = format;
        format = undefined;
    }

    format = format || '';

    if (index != null) {
        return get$1(format, index, field, 'month');
    }

    var i;
    var out = [];
    for (i = 0; i < 12; i++) {
        out[i] = get$1(format, i, field, 'month');
    }
    return out;
}

// ()
// (5)
// (fmt, 5)
// (fmt)
// (true)
// (true, 5)
// (true, fmt, 5)
// (true, fmt)
function listWeekdaysImpl (localeSorted, format, index, field) {
    if (typeof localeSorted === 'boolean') {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';
    } else {
        format = localeSorted;
        index = format;
        localeSorted = false;

        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';
    }

    var locale = getLocale(),
        shift = localeSorted ? locale._week.dow : 0;

    if (index != null) {
        return get$1(format, (index + shift) % 7, field, 'day');
    }

    var i;
    var out = [];
    for (i = 0; i < 7; i++) {
        out[i] = get$1(format, (i + shift) % 7, field, 'day');
    }
    return out;
}

function listMonths (format, index) {
    return listMonthsImpl(format, index, 'months');
}

function listMonthsShort (format, index) {
    return listMonthsImpl(format, index, 'monthsShort');
}

function listWeekdays (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
}

function listWeekdaysShort (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
}

function listWeekdaysMin (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
}

getSetGlobalLocale('en', {
    dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
    ordinal : function (number) {
        var b = number % 10,
            output = (toInt(number % 100 / 10) === 1) ? 'th' :
            (b === 1) ? 'st' :
            (b === 2) ? 'nd' :
            (b === 3) ? 'rd' : 'th';
        return number + output;
    }
});

// Side effect imports
hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

var mathAbs = Math.abs;

function abs () {
    var data           = this._data;

    this._milliseconds = mathAbs(this._milliseconds);
    this._days         = mathAbs(this._days);
    this._months       = mathAbs(this._months);

    data.milliseconds  = mathAbs(data.milliseconds);
    data.seconds       = mathAbs(data.seconds);
    data.minutes       = mathAbs(data.minutes);
    data.hours         = mathAbs(data.hours);
    data.months        = mathAbs(data.months);
    data.years         = mathAbs(data.years);

    return this;
}

function addSubtract$1 (duration, input, value, direction) {
    var other = createDuration(input, value);

    duration._milliseconds += direction * other._milliseconds;
    duration._days         += direction * other._days;
    duration._months       += direction * other._months;

    return duration._bubble();
}

// supports only 2.0-style add(1, 's') or add(duration)
function add$1 (input, value) {
    return addSubtract$1(this, input, value, 1);
}

// supports only 2.0-style subtract(1, 's') or subtract(duration)
function subtract$1 (input, value) {
    return addSubtract$1(this, input, value, -1);
}

function absCeil (number) {
    if (number < 0) {
        return Math.floor(number);
    } else {
        return Math.ceil(number);
    }
}

function bubble () {
    var milliseconds = this._milliseconds;
    var days         = this._days;
    var months       = this._months;
    var data         = this._data;
    var seconds, minutes, hours, years, monthsFromDays;

    // if we have a mix of positive and negative values, bubble down first
    // check: https://github.com/moment/moment/issues/2166
    if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
            (milliseconds <= 0 && days <= 0 && months <= 0))) {
        milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
        days = 0;
        months = 0;
    }

    // The following code bubbles up values, see the tests for
    // examples of what that means.
    data.milliseconds = milliseconds % 1000;

    seconds           = absFloor(milliseconds / 1000);
    data.seconds      = seconds % 60;

    minutes           = absFloor(seconds / 60);
    data.minutes      = minutes % 60;

    hours             = absFloor(minutes / 60);
    data.hours        = hours % 24;

    days += absFloor(hours / 24);

    // convert days to months
    monthsFromDays = absFloor(daysToMonths(days));
    months += monthsFromDays;
    days -= absCeil(monthsToDays(monthsFromDays));

    // 12 months -> 1 year
    years = absFloor(months / 12);
    months %= 12;

    data.days   = days;
    data.months = months;
    data.years  = years;

    return this;
}

function daysToMonths (days) {
    // 400 years have 146097 days (taking into account leap year rules)
    // 400 years have 12 months === 4800
    return days * 4800 / 146097;
}

function monthsToDays (months) {
    // the reverse of daysToMonths
    return months * 146097 / 4800;
}

function as (units) {
    if (!this.isValid()) {
        return NaN;
    }
    var days;
    var months;
    var milliseconds = this._milliseconds;

    units = normalizeUnits(units);

    if (units === 'month' || units === 'year') {
        days   = this._days   + milliseconds / 864e5;
        months = this._months + daysToMonths(days);
        return units === 'month' ? months : months / 12;
    } else {
        // handle milliseconds separately because of floating point math errors (issue #1867)
        days = this._days + Math.round(monthsToDays(this._months));
        switch (units) {
            case 'week'   : return days / 7     + milliseconds / 6048e5;
            case 'day'    : return days         + milliseconds / 864e5;
            case 'hour'   : return days * 24    + milliseconds / 36e5;
            case 'minute' : return days * 1440  + milliseconds / 6e4;
            case 'second' : return days * 86400 + milliseconds / 1000;
            // Math.floor prevents floating point math errors here
            case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
            default: throw new Error('Unknown unit ' + units);
        }
    }
}

// TODO: Use this.as('ms')?
function valueOf$1 () {
    if (!this.isValid()) {
        return NaN;
    }
    return (
        this._milliseconds +
        this._days * 864e5 +
        (this._months % 12) * 2592e6 +
        toInt(this._months / 12) * 31536e6
    );
}

function makeAs (alias) {
    return function () {
        return this.as(alias);
    };
}

var asMilliseconds = makeAs('ms');
var asSeconds      = makeAs('s');
var asMinutes      = makeAs('m');
var asHours        = makeAs('h');
var asDays         = makeAs('d');
var asWeeks        = makeAs('w');
var asMonths       = makeAs('M');
var asYears        = makeAs('y');

function get$2 (units) {
    units = normalizeUnits(units);
    return this.isValid() ? this[units + 's']() : NaN;
}

function makeGetter(name) {
    return function () {
        return this.isValid() ? this._data[name] : NaN;
    };
}

var milliseconds = makeGetter('milliseconds');
var seconds      = makeGetter('seconds');
var minutes      = makeGetter('minutes');
var hours        = makeGetter('hours');
var days         = makeGetter('days');
var months       = makeGetter('months');
var years        = makeGetter('years');

function weeks () {
    return absFloor(this.days() / 7);
}

var round = Math.round;
var thresholds = {
    ss: 44,         // a few seconds to seconds
    s : 45,         // seconds to minute
    m : 45,         // minutes to hour
    h : 22,         // hours to day
    d : 26,         // days to month
    M : 11          // months to year
};

// helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
    return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
}

function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
    var duration = createDuration(posNegDuration).abs();
    var seconds  = round(duration.as('s'));
    var minutes  = round(duration.as('m'));
    var hours    = round(duration.as('h'));
    var days     = round(duration.as('d'));
    var months   = round(duration.as('M'));
    var years    = round(duration.as('y'));

    var a = seconds <= thresholds.ss && ['s', seconds]  ||
            seconds < thresholds.s   && ['ss', seconds] ||
            minutes <= 1             && ['m']           ||
            minutes < thresholds.m   && ['mm', minutes] ||
            hours   <= 1             && ['h']           ||
            hours   < thresholds.h   && ['hh', hours]   ||
            days    <= 1             && ['d']           ||
            days    < thresholds.d   && ['dd', days]    ||
            months  <= 1             && ['M']           ||
            months  < thresholds.M   && ['MM', months]  ||
            years   <= 1             && ['y']           || ['yy', years];

    a[2] = withoutSuffix;
    a[3] = +posNegDuration > 0;
    a[4] = locale;
    return substituteTimeAgo.apply(null, a);
}

// This function allows you to set the rounding function for relative time strings
function getSetRelativeTimeRounding (roundingFunction) {
    if (roundingFunction === undefined) {
        return round;
    }
    if (typeof(roundingFunction) === 'function') {
        round = roundingFunction;
        return true;
    }
    return false;
}

// This function allows you to set a threshold for relative time strings
function getSetRelativeTimeThreshold (threshold, limit) {
    if (thresholds[threshold] === undefined) {
        return false;
    }
    if (limit === undefined) {
        return thresholds[threshold];
    }
    thresholds[threshold] = limit;
    if (threshold === 's') {
        thresholds.ss = limit - 1;
    }
    return true;
}

function humanize (withSuffix) {
    if (!this.isValid()) {
        return this.localeData().invalidDate();
    }

    var locale = this.localeData();
    var output = relativeTime$1(this, !withSuffix, locale);

    if (withSuffix) {
        output = locale.pastFuture(+this, output);
    }

    return locale.postformat(output);
}

var abs$1 = Math.abs;

function toISOString$1() {
    // for ISO strings we do not use the normal bubbling rules:
    //  * milliseconds bubble up until they become hours
    //  * days do not bubble at all
    //  * months bubble up until they become years
    // This is because there is no context-free conversion between hours and days
    // (think of clock changes)
    // and also not between days and months (28-31 days per month)
    if (!this.isValid()) {
        return this.localeData().invalidDate();
    }

    var seconds = abs$1(this._milliseconds) / 1000;
    var days         = abs$1(this._days);
    var months       = abs$1(this._months);
    var minutes, hours, years;

    // 3600 seconds -> 60 minutes -> 1 hour
    minutes           = absFloor(seconds / 60);
    hours             = absFloor(minutes / 60);
    seconds %= 60;
    minutes %= 60;

    // 12 months -> 1 year
    years  = absFloor(months / 12);
    months %= 12;


    // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
    var Y = years;
    var M = months;
    var D = days;
    var h = hours;
    var m = minutes;
    var s = seconds;
    var total = this.asSeconds();

    if (!total) {
        // this is the same as C#'s (Noda) and python (isodate)...
        // but not other JS (goog.date)
        return 'P0D';
    }

    return (total < 0 ? '-' : '') +
        'P' +
        (Y ? Y + 'Y' : '') +
        (M ? M + 'M' : '') +
        (D ? D + 'D' : '') +
        ((h || m || s) ? 'T' : '') +
        (h ? h + 'H' : '') +
        (m ? m + 'M' : '') +
        (s ? s + 'S' : '');
}

var proto$2 = Duration.prototype;

proto$2.isValid        = isValid$1;
proto$2.abs            = abs;
proto$2.add            = add$1;
proto$2.subtract       = subtract$1;
proto$2.as             = as;
proto$2.asMilliseconds = asMilliseconds;
proto$2.asSeconds      = asSeconds;
proto$2.asMinutes      = asMinutes;
proto$2.asHours        = asHours;
proto$2.asDays         = asDays;
proto$2.asWeeks        = asWeeks;
proto$2.asMonths       = asMonths;
proto$2.asYears        = asYears;
proto$2.valueOf        = valueOf$1;
proto$2._bubble        = bubble;
proto$2.get            = get$2;
proto$2.milliseconds   = milliseconds;
proto$2.seconds        = seconds;
proto$2.minutes        = minutes;
proto$2.hours          = hours;
proto$2.days           = days;
proto$2.weeks          = weeks;
proto$2.months         = months;
proto$2.years          = years;
proto$2.humanize       = humanize;
proto$2.toISOString    = toISOString$1;
proto$2.toString       = toISOString$1;
proto$2.toJSON         = toISOString$1;
proto$2.locale         = locale;
proto$2.localeData     = localeData;

// Deprecations
proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
proto$2.lang = lang;

// Side effect imports

// FORMATTING

addFormatToken('X', 0, 0, 'unix');
addFormatToken('x', 0, 0, 'valueOf');

// PARSING

addRegexToken('x', matchSigned);
addRegexToken('X', matchTimestamp);
addParseToken('X', function (input, array, config) {
    config._d = new Date(parseFloat(input, 10) * 1000);
});
addParseToken('x', function (input, array, config) {
    config._d = new Date(toInt(input));
});

// Side effect imports


hooks.version = '2.18.1';

setHookCallback(createLocal);

hooks.fn                    = proto;
hooks.min                   = min;
hooks.max                   = max;
hooks.now                   = now;
hooks.utc                   = createUTC;
hooks.unix                  = createUnix;
hooks.months                = listMonths;
hooks.isDate                = isDate;
hooks.locale                = getSetGlobalLocale;
hooks.invalid               = createInvalid;
hooks.duration              = createDuration;
hooks.isMoment              = isMoment;
hooks.weekdays              = listWeekdays;
hooks.parseZone             = createInZone;
hooks.localeData            = getLocale;
hooks.isDuration            = isDuration;
hooks.monthsShort           = listMonthsShort;
hooks.weekdaysMin           = listWeekdaysMin;
hooks.defineLocale          = defineLocale;
hooks.updateLocale          = updateLocale;
hooks.locales               = listLocales;
hooks.weekdaysShort         = listWeekdaysShort;
hooks.normalizeUnits        = normalizeUnits;
hooks.relativeTimeRounding = getSetRelativeTimeRounding;
hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
hooks.calendarFormat        = getCalendarFormat;
hooks.prototype             = proto;

return hooks;

})));

var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.Http = (function() {
  var getParams;

  function Http(options) {
    var base;
    this.options = options;
    if (window.ActiveXObject) {
      this.xhr = new ActiveXObject('Microsoft.XMLHTTP');
    } else if (window.XMLHttpRequest) {
      this.xhr = new XMLHttpRequest;
    }
    if ((base = this.options).host == null) {
      base.host = {};
    }
  }

  Http.prototype.execute = function() {
    var contextType, isFirefox;
    if (this.xhr) {
      this.xhr.onreadystatechange = (function(_this) {
        return function() {
          var result;
          if (_this.xhr.readyState === 4 && _this.xhr.status === 200) {
            result = _this.xhr.responseText;
            if (_this.options.json && typeof JSON !== 'undefined') {
              result = JSON.parse(result);
            }
            _this.options.success && _this.options.success.apply(_this.options.host, [result, _this.xhr]);
          } else if (_this.xhr.readyState === 4) {
            _this.options.failure && _this.options.failure.apply(_this.options.host, [_this.xhr]);
          }
          return _this.options.ensure && _this.options.ensure.apply(_this.options.host, [_this.xhr]);
        };
      })(this);
      if (this.options.method === 'get') {
        this.xhr.open('GET', this.options.url + getParams(this.options.data, this.options.url), true);
      } else {
        isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (this.options.auth && !isFirefox) {
          this.xhr.open(this.options.method, this.options.url, true, this.options.user, this.options.password);
        } else {
          this.xhr.open(this.options.method, this.options.url, true);
        }
      }
      if (this.options.data) {
        contextType = this.options.json ? 'application/json' : 'application/x-www-form-urlencoded';
        this.setHeaders({
          'Content-Type': contextType
        });
      }
      this.setHeaders({
        'X-Requested-With': 'XMLHttpRequest'
      });
      if (this.options.auth) {
        this.setHeaders({
          'Authorization': 'Basic ' + btoa(this.options.user + ":" + this.options.password)
        });
        if ('withCredentials' in this.xhr) {
          this.xhr.withCredentials = 'true';
        }
      }
      this.setHeaders(this.options.headers);
      if (this.options.method === 'get') {
        return this.xhr.send();
      } else if (this.options.json) {
        return this.xhr.send(JSON.stringify(this.options.data));
      } else {
        return this.xhr.send(getParams(this.options.data));
      }
    }
  };

  Http.prototype.setHeaders = function(headers) {
    var name, results;
    results = [];
    for (name in headers) {
      results.push(this.xhr && this.xhr.setRequestHeader(name, headers[name]));
    }
    return results;
  };

  getParams = function(data, url) {
    var arr, name, str;
    arr = [];
    str = void 0;
    for (name in data) {
      arr.push(name + "=" + (encodeURIComponent(data[name])));
    }
    str = arr.join('&');
    if (str !== '') {
      if (url) {
        if (url.indexOf('?') < 0) {
          return "?" + str;
        } else {
          return "&" + str;
        }
      } else {
        return str;
      }
    }
    return '';
  };

  return Http;

})();

var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.Event = (function() {
  function Event(options) {
    if (options.logLevel == null) {
      options.logLevel = 'EVENT';
    }
    if (options.environment == null) {
      options.environment = 'production';
    }
    if (options.tags == null) {
      options.tags = [];
    }
    if (options.json == null) {
      options.json = {};
    }
    if (this.accountId == null) {
      this.accountId = options.accountId;
    }
    if (this.appId == null) {
      this.appId = options.appId;
    }
    if (this.channelId == null) {
      this.channelId = options.channelId;
    }
    if (this.sessionId == null) {
      this.sessionId = options.sessionId;
    }
    if (this.eventName == null) {
      this.eventName = options.eventName;
    }
    if (this.clientEventTime == null) {
      this.clientEventTime = options.clientEventTime;
    }
    if (this.clientId == null) {
      this.clientId = options.clientId;
    }
    if (this.logLevel == null) {
      this.logLevel = options.logLevel;
    }
    if (this.environment == null) {
      this.environment = options.environment;
    }
    if (this.tags == null) {
      this.tags = options.tags;
    }
    if (this.json == null) {
      this.json = options.json;
    }
  }

  return Event;

})();

Binnacle.Client = (function() {
  var configureMessage;

  function Client(options) {
    if (options.environment == null) {
      options.environment = 'production';
    }
    this.options = options;
    this.channelChannelUrl = this.options.endPoint + "/api/subscribe/channel/" + this.options.channelId + "/" + this.options.environment;
    this.appChannelUrl = this.options.endPoint + "/api/subscribe/app/" + this.options.appId + "/" + this.options.environment;
    this.subscribersUrl = this.options.endPoint + "/api/subscribers/" + this.options.channelId + "/" + this.options.environment;
    this.notificationsUrl = this.options.endPoint + "/api/subscribe/ntf/" + this.options.accountId;
    this.signalUrl = this.options.endPoint + "/api/events/" + this.options.channelId;
    this.recentsUrl = this.options.endPoint + "/api/events/" + this.options.channelId + "/{environment}/recents";
    this.messagesReceived = 0;
    this.socket = atmosphere;
  }

  Client.prototype.signal = function(event) {
    var http;
    http = new Binnacle.Http({
      url: this.signalUrl,
      method: 'post',
      json: true,
      data: event,
      auth: true,
      user: this.options.apiKey,
      password: this.options.apiSecret
    });
    http.execute();
    return console.log("Signalling " + event);
  };

  Client.prototype.recents = function(params) {
    var http, limit, since, url;
    if (params == null) {
      params = {};
    }
    limit = params['limit'] || this.options.limit;
    since = params['since'] || this.options.since;
    url = this.recentsUrl;
    url += "?limit=" + limit + "&since=" + since;
    http = new Binnacle.Http({
      url: url,
      method: 'get',
      json: true,
      auth: true,
      user: this.options.apiKey,
      password: this.options.apiSecret,
      success: this.options.onSignals
    });
    return http.execute();
  };

  Client.prototype.subscribers = function(callback) {
    var http;
    http = new Binnacle.Http({
      url: this.subscribersUrl,
      method: 'get',
      json: true,
      auth: true,
      user: this.options.apiKey,
      password: this.options.apiSecret,
      success: callback
    });
    return http.execute();
  };

  Client.prototype.subscribe = function() {
    var request, sep;
    request = new atmosphere.AtmosphereRequest();
    if (this.options.accountId) {
      request.url = this.notificationsUrl;
    } else if (this.options.appId) {
      request.url = this.appChannelUrl;
    } else {
      request.url = this.channelChannelUrl;
    }
    if (this.options.missedMessages) {
      request.url += "?mm=true";
      if (this.options.limit) {
        request.url += "&mm-limit=" + this.options.limit;
      }
      if (this.options.since) {
        request.url += "&mm-since=" + this.options.since;
      }
    }
    if (this.options.filterBy) {
      sep = this.options.missedMessages ? '&' : '?';
      request.url += sep + "filterBy=" + this.options.filterBy;
      request.url += "&filterByValue=" + this.options.filterByValue;
    }
    if (this.options.identity) {
      sep = this.options.missedMessages ? '&' : '?';
      request.url += sep + "psId=" + this.options.identity;
    }
    request.contentType = 'application/json';
    request.logLevel = 'debug';
    request.transport = 'websocket';
    request.fallbackTransport = 'long-polling';
    request.reconnectInterval = 2000;
    request.maxReconnectOnClose = 300;
    request.timeout = 86400000;
    request.headers = {
      Authorization: 'Basic ' + btoa(this.options.apiKey + ":" + this.options.apiSecret)
    };
    request.onOpen = (function(_this) {
      return function(response) {
        if (_this.options.onOpen != null) {
          _this.options.onOpen(response);
        }
        return console.log("Binnacle connected using " + response.transport);
      };
    })(this);
    request.onError = (function(_this) {
      return function(response) {
        if (_this.options.onError != null) {
          _this.options.onError(response);
        }
        return console.log("Sorry, but there's some problem with your socket or the Binnacle server is down");
      };
    })(this);
    request.onMessage = (function(_this) {
      return function(response) {
        var e, error, i, json, len, message, messageAsString, messages, payload;
        _this.messagesReceived = _this.messagesReceived + 1;
        json = response.responseBody;
        try {
          payload = JSON.parse(json);
          if (Object.prototype.toString.call(payload) === '[object Array]') {
            if (_this.options.onSignals != null) {
              messages = [];
              for (i = 0, len = payload.length; i < len; i++) {
                message = payload[i];
                messages.push(configureMessage(message));
              }
              _this.options.onSignals(messages);
            }
          } else {
            if (payload.eventName === 'subscriber_joined') {
              if (_this.options.onSubscriberJoined != null) {
                _this.options.onSubscriberJoined(payload);
              }
            } else if (payload.eventName === 'subscriber_left') {
              if (_this.options.onSubscriberLeft != null) {
                _this.options.onSubscriberLeft(payload);
              }
            } else if (payload.eventName === 'error') {
              console.log("ERROR: " + payload.message);
              _this.socket.unsubscribe();
            } else {
              if (_this.options.onSignal != null) {
                _this.options.onSignal(configureMessage(payload));
              }
            }
          }
          messageAsString = JSON.stringify(json);
          return console.log("Received Message: \n" + messageAsString);
        } catch (error) {
          e = error;
          return console.log("Error processing payload: \n " + json, e);
        }
      };
    })(this);
    return this.socket.subscribe(request);
  };

  Client.prototype.unsubscribe = function() {
    return this.socket.unsubscribe();
  };

  Client.prototype.messagesReceived = Client.messagesReceived;

  configureMessage = function(message) {
    message.eventTime = moment(new Date(message['eventTime'])).format();
    message.clientEventTime = moment(new Date(message['clientEventTime'])).format();
    return message;
  };

  return Client;

})();

var root;

root = typeof global !== "undefined" && global !== null ? global : window;

if (root.Binnacle == null) {
  root.Binnacle = {};
}

Binnacle.PushSubscription = (function() {
  function PushSubscription(options) {
    if (options.subscriptionType == null) {
      options.subscriptionType = 'firebase';
    }
    if (options.kvm == null) {
      options.kvm = {};
    }
    if (this.channelId == null) {
      this.channelId = options.channelId;
    }
    if (this.subscriptionType == null) {
      this.subscriptionType = options.subscriptionType;
    }
    if (this.userIdentifier == null) {
      this.userIdentifier = options.userIdentifier;
    }
    if (this.ipAddress == null) {
      this.ipAddress = options.ipAddress;
    }
    if (this.token == null) {
      this.token = options.token;
    }
    if (this.kvm == null) {
      this.kvm = options.kvm;
    }
  }

  return PushSubscription;

})();

Binnacle.WebPushClient = (function() {
  var isTokenSentToServer, setTokenSentToServer;

  function WebPushClient(options) {
    var base, base1, base2, base3, base4, base5, base6, base7, base8;
    this.options = options;
    if ((base = this.options).onMessage == null) {
      base.onMessage = function(payload) {};
    }
    if ((base1 = this.options).onTokenRefresh == null) {
      base1.onTokenRefresh = function() {};
    }
    if ((base2 = this.options).onBeforePermissionRequest == null) {
      base2.onBeforePermissionRequest = function() {};
    }
    if ((base3 = this.options).onPermissionGranted == null) {
      base3.onPermissionGranted = function() {};
    }
    if ((base4 = this.options).onPermissionFailed == null) {
      base4.onPermissionFailed = function() {};
    }
    if ((base5 = this.options).onTokenDeleted == null) {
      base5.onTokenDeleted = function() {};
    }
    if ((base6 = this.options).onErrorDeletingToken == null) {
      base6.onErrorDeletingToken = function() {};
    }
    if ((base7 = this.options).onErrorRetrievingToken == null) {
      base7.onErrorRetrievingToken = function() {};
    }
    if ((base8 = this.options).onErrorRetrievingRefreshedToken == null) {
      base8.onErrorRetrievingRefreshedToken = function() {};
    }
    this.webPushTokenRegistrationUrl = this.options.endPoint + "/api/push-subscriptions/" + this.options.channelId;
  }

  WebPushClient.prototype.subscribe = function() {
    if (!this.messaging) {
      this.initialize();
    }
    return this.getTokenAndSubscribe();
  };

  WebPushClient.prototype.initialize = function() {
    var config;
    config = {
      apiKey: this.options.firebaseApiKey,
      messagingSenderId: this.options.firebaseMessagingSenderId
    };
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    this.messaging = firebase.messaging();
    this.messaging.onMessage((function(_this) {
      return function(payload) {
        console.log('Message received. ', payload);
        return _this.options.onMessage(payload);
      };
    })(this));
    return this.messaging.onTokenRefresh((function(_this) {
      return function() {
        return messaging.getToken().then(function(refreshedToken) {
          setTokenSentToServer(false);
          sendTokenToServer(refreshedToken);
          return _this.options.onTokenRefresh();
        })["catch"](function(err) {
          console.log('Unable to retrieve refreshed token ', err);
          return this.options.onErrorRetrievingRefreshedToken();
        });
      };
    })(this));
  };

  WebPushClient.prototype.getToken = function() {
    return this.messaging.getToken();
  };

  WebPushClient.prototype.getTokenAndSubscribe = function() {
    return this.messaging.getToken().then((function(_this) {
      return function(currentToken) {
        if (currentToken) {
          return _this.sendTokenToServer(currentToken);
        } else {
          _this.options.onBeforePermissionRequest();
          return _this.messaging.requestPermission().then(function() {
            _this.options.onPermissionGranted();
            return _this.getToken().then(function(currentToken) {
              return _this.sendTokenToServer(currentToken);
            });
          })["catch"](function(err) {
            console.log('Unable to get permission to notify.', err);
            _this.options.onPermissionFailed();
            return setTokenSentToServer(false);
          });
        }
      };
    })(this))["catch"](function(err) {
      console.log('An error occurred while retrieving token. ', err);
      return setTokenSentToServer(false);
    });
  };

  WebPushClient.prototype.sendTokenToServer = function(currentToken) {
    var http, pushSubscription;
    if (!isTokenSentToServer()) {
      pushSubscription = new Binnacle.PushSubscription({
        channelId: this.options.channelId,
        subscriptionType: 'firebase',
        userIdentifier: this.options.userIdentifier,
        token: currentToken,
        ipAddress: '',
        kvm: {
          token: currentToken
        }
      });
      http = new Binnacle.Http({
        url: this.webPushTokenRegistrationUrl,
        method: 'POST',
        json: true,
        auth: true,
        user: this.options.apiKey,
        password: this.options.apiSecret,
        data: pushSubscription
      });
      http.execute();
      return setTokenSentToServer(true);
    }
  };

  WebPushClient.prototype.deleteToken = function() {
    return this.messaging.getToken().then(function(currentToken) {
      return this.messaging.deleteToken(currentToken).then(function() {
        setTokenSentToServer(false);
        return this.options.onTokenDeleted();
      })["catch"](function(err) {
        console.log('Unable to delete token. ', err);
        return this.options.onErrorDeletingToken();
      });
    })["catch"](function(err) {
      console.log('Error retrieving Instance ID token. ', err);
      return this.options.onErrorRetrievingToken();
    });
  };

  isTokenSentToServer = function() {
    if (window.localStorage.getItem('sentToServer') === 1) {
      return true;
    } else {
      return false;
    }
  };

  setTokenSentToServer = function(sent) {
    return window.localStorage.setItem('sentToServer', sent ? 1 : 0);
  };

  return WebPushClient;

})();
