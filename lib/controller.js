
// Using STRICT mode for ES6 features
"use strict";

/**
 * Requiring core Events module
 */
var events = require('events');

/**
 * Async events execution
 */
var async = require('async');

/**
 * Controller events
 * @type {{START: string, PRE_INIT: string, INIT: string, PRE_LOAD: string, LOAD: string, DATA_READY: string, PRE_RENDER: string, RENDER: string, POST_RENDER: string}}
 */
var ControllerEvent = {
    START: 'START',
    PRE_INIT: 'PRE_INIT',
    INIT: 'INIT',
    PRE_LOAD: 'PRE_LOAD',
    LOAD: 'LOAD',
    DATA_READY: 'DATA_READY',
    PRE_RENDER: 'PRE_RENDER',
    RENDER: 'RENDER',
    POST_RENDER: 'POST_RENDER'
};

var ExecutionState = {
    RUNNING: 'RUNNING',
    FAILED: 'FAILED',
    TERMINATED: 'TERMINATED'
}

/**
 *  Base controller. Implements HTML page lifecycle.
 *
 *  @author Eugene A. Kalosha <ekalosha@dioscouri.com>
 */
class Controller extends events.EventEmitter {

    /**
     * Controller constructor
     */
    constructor (request, response) {
        // We must call super() in child class to have access to 'this' in a constructor
        super();


        /**
         * Flash Message system
         *
         * @private
         */
        this._flash = new (require('./flashmessages.js').FlashMessages)(request);

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./logger.js');

        /**
         * Request instance
         *
         * @type {*|req|*|req}
         * @private
         */
        this._request = request;

        /**
         * Response Instance
         *
         * @type {*|res|Object|*|res|Object}
         * @private
         */
        this._response = response;

        /**
         * Response data
         *
         * @type {{}}
         */
        this.data = {};

        this._executionState = null;
        this._lifecicleError = null;

        // Map of allowed actions
        this._allowedActions = {};
    }

    /**
     * Flash Message
     *
     * @returns {*|FlashMessage}
     */
    get flash () {
        return this._flash;
    }


    /**
     * HTTP Request instance
     *
     * @returns {*|req}
     */
    get request () {
        return this._request;
    }

    /**
     * HTTP Response instance
     *
     * @returns {*|res|Object}
     */
    get response () {
        return this._response;
    }

    /**
     * Get execution state
     *
     * @returns {null|string|*}
     */
    get executionState () {
        return this._executionState;
    }

    /**
     * Terminate controller lifecycle and go to the termination action
     */
    terminate () {
        this._executionState = ExecutionState.TERMINATED;
    }

    /**
     * Check is controller terminated during lifecycle
     */
    isTerminated () {
        return this._executionState == ExecutionState.TERMINATED;
    }

    /**
     * Check is controller failed during lifecycle
     */
    isFailed () {
        return this._executionState == ExecutionState.FAILED;
    }

    /**
     * Start application
     */
    start (callback) {
        callback();
    }

    /**
     * Pre-initialize data and event handlers
     */
    preInit (callback) {
        callback();
    }

    /**
     * Initialize data and event handlers
     */
    init (callback) {
        callback();
    }

    /**
     * Load view file
     *
     * @param callback
     */
    preLoad (callback) {
        callback(null);
    }

    /**
     * Load view file
     *
     * @param dataReadyCallback
     */
    load (dataReadyCallback) {
        dataReadyCallback(null);
    }

    /**
     * Set view for controller
     */
    view (viewDetails) {
        this._view = viewDetails;
    }

    /**
     * Check propagation error for controller and set callback if needed
     * @param callback
     */
    checkControllerPropagationError (callback) {
        var result = true;

        if (this._executionState == ExecutionState.TERMINATED) {
            callback(new Error('Controller terminated'));

            result = false;
        } else if (this._executionState == ExecutionState.FAILED) {
            callback(new Error('Controller failed'));

            result = false;
        }

        return result;
    }

    /**
     * Load view file
     *
     * @param callback
     */
    preRender (callback) {
        callback(null);
    }

    /**
     * Render controller output
     */
    render (callback) {
        this.emit(ControllerEvent.RENDER);

        if (this._view != null) {
            // Reset data to view
            if (this.data != null && Object.keys(this.data).length > 0) {
                this._view.data = this.data;
            }

            // Set lifecycle error if any
            if (this._lifecicleError != null) {
                this._view.error = this._lifecicleError;
            }

            // Load helpers
            this._view.data.moment = require('moment');

            // load all flash messages
            this.data.flashMessages = this._flash.getMessages();

            // Rendering view to the response object
            this._view.render(this.response, this.request);
            this.response.end();
        } else {
            this.response.send('OK');
        }

        // Loading render callback
        callback();
    }

    /**
     * Render error
     */
    renderError (error){
        if (this._view != null) {
            this._view.error = error;
            this._view.render();
        } else {
            this.response.status(500).send(error.message);
        }
    }

    /**
     * Callback on Controller terminated action
     *
     * @param callback
     */
    onTerminated(callback) {
        callback();
    }

    /**
     * Callback on Controller done action
     *
     * @param callback
     */
    onDone(callback) {
        callback();
    }

    /**
     * Analyzing controller lifecycle error
     *
     * @param error
     */
    analyzeLifecycleError(error) {
        if (error != null) {
            this._executionState = ExecutionState.TERMINATED;
            this._lifecicleError = error;
        }
    }

    /**
     * Run controller Life Cycle
     */
    run () {
        // Create closure
        var $this = this;

        // Starting asynch execution of controller Lifecycle
        async.series([
            // Starting Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Starting Controller %s', this.request.route.path);
                this.start(asyncCallback);
                this.emit(ControllerEvent.START);
            }.bind(this),

            // Pre-Initializing Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Pre-Initializing Controller %s', this.request.route.path);
                this.preInit(asyncCallback);
                this.emit(ControllerEvent.PRE_INIT);
            }.bind(this),

            // Initializing Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Initializing Controller %s', this.request.route.path);
                this.init(asyncCallback);
                this.emit(ControllerEvent.INIT);
            }.bind(this),

            // Pre Loading Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Pre-loading Controller %s', this.request.route.path);
                this.preLoad(asyncCallback);
                this.emit(ControllerEvent.PRE_LOAD);
            }.bind(this),

            // Loading Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Loading Controller %s', this.request.route.path);
                this.applyLoad(asyncCallback);

                // Set data ready status
                this.emit(ControllerEvent.LOAD);
                this.emit(ControllerEvent.DATA_READY);
            }.bind(this),

            // Pre rendering Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Pre-rendering Controller %s', this.request.route.path);
                this.preRender(asyncCallback);

                // Set pre-render status
                this.emit(ControllerEvent.PRE_RENDER);
            }.bind(this),

            // Rendering Controller
            function(asyncCallback){
                if (!this.checkControllerPropagationError (asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Rendering Controller %s', this.request.route.path);
                this.render(asyncCallback);

                // Set render status
                this.emit(ControllerEvent.RENDER);
            }.bind(this)
        ], function(error){

            // Set view error
            if (error != null) {
                // Set error
                if (!this.isTerminated()) {
                    this.renderError(error);
                }
            }

            // Processing final actions
            async.series([
                function(asyncCallback){
                    if (this.isTerminated()) {
                        this.onTerminated(function(error){
                            this._logger.debug('@@@@ Controller Termination Handler');
                            asyncCallback(error);
                        }.bind(this));
                    } else {
                        asyncCallback(null);
                    }
                }.bind(this),
                function(asyncCallback){
                    this.onDone(function(error){
                        this._logger.debug('@@@@ Controller Finished');
                        asyncCallback(error);
                    }.bind(this));
                }.bind(this)
            ], function(error){
                ;
            });


        }.bind(this));
    }

    /**
     * Applying Load stage. Loading action.
     *
     * @param callback
     */
    applyLoad (callback) {
        /**
         * Loading data
         */
        // Trying to run action
        if (this.request.params.action != null) {
            this._logger.debug('@@ Trying to load requested action: %s', this.request.params.action);
            if (this._allowedActions[this.request.params.action] != null) {
                var methodName = this._allowedActions[this.request.params.action].method;
                if (this[methodName] instanceof Function) {
                    this[methodName](function(error) {
                        if (error != null) {
                            this._logger.warn('Failed to execute action %s. [%s]', this.request.params.action, error.message);
                        }
                        callback(error);
                    }.bind(this));
                } else {
                    this._logger.warn('Specified action is not exists: %s', methodName);
                    this.response.status(500).send("Specified action is not exists");
                    callback(new Error("Specified action is not exists"));
                }
            } else {
                this._logger.warn('Specified action is not allowed: %s', this.request.params.action);
                this.response.status(500).send("Specified action is not allowed");
                callback(new Error("Specified action is not allowed"));
            }
        } else {
            this.load(callback);
        }
    }

    /**
     * Register Action handler method
     *
     * @param {string} actionName
     * @param {string} methodName if not set actionName used instead
     */
    registerAction(actionName, methodName) {
        var actionDetails = {};
        actionDetails.method = (methodName != null ? methodName : actionName);

        this._allowedActions[actionName] = actionDetails;
    }

    /**
     * Removes Action handler method
     *
     * @param {string} actionName
     */
    removeAction(actionName) {
        if (this._allowedActions[actionName] != null) {
            delete this._allowedActions[actionName];
        }
    }

    /**
     * Check is user authentificated
     *
     * @returns {*}
     */
    isAuthenticated () {
        return this.request.isAuthenticated()
    }

    /**
     * Check is current user has Admin right
     *
     * @returns {boolean}
     */
    isAdminUser () {
        if (this.isAuthenticated() && this.request.user.isAdmin) {
            return true;
        }
        return false;
    }
};

/**
 * Exporting Controller Classes and Events
 */
module.exports.ControllerEvent = ControllerEvent;
module.exports.ExecutionState = ExecutionState;
module.exports.Controller = Controller;