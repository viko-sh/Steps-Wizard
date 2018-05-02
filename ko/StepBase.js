/*global __g_sm,Q, toggleGorila, ko, _, $, Modernizr*/
define([],
    function()
    {
        'use strict';

        /**
         * Constructor
         * @constructor
         * @returns {void}
         */
        function StepBase()
        {
            this.title = undefined;
            this.wizard = undefined;

        }

        /**
         * Init step
         * @param {object} params - params from binding
         * @private
         * @returns {void}
         */
        StepBase.prototype.__init = function(params)
        {
            this.wizard = params.parent;
            if (_.isFunction(this.stepInit))
            {
                this.stepInit();
            }

            this.wizard.title(this.title);
        };

        /**
         * Update Wizard class
         * @private
         * @returns {void}
         */
        StepBase.prototype.__updateWizard = function()
        {
            this.wizard.title(this.title);
        };

        /**
         * tooltip function
         * @returns {string|null} - the tooltip string to show in the progress bar
         * @private
         */
        StepBase.prototype.__titleSummary = function()
        {
            var tooltip = '';
            if ( !this.silentValidation() )
            {
                return null;
            }
            ko.utils.arrayForEach(this.getKeys(), function(key)
            {
                if (ko.isObservable(this[key]) && this[key].showOnSummary() && !ko.utils.isEmpty(this[key], false) )
                {
                    tooltip += '<span>';
                    tooltip += this.formatToForm(key) + ': ';
                    tooltip += this.showKeyContent(this[key], 'name');
                    tooltip += '</span><br/>';
                }
            }.bind(this));

            if ( !_.isEmpty(tooltip))
            {
                tooltip = '<p>' + tooltip;
                tooltip += '</p>';
            }
            return tooltip;
        };

        /**
         * Get
         * @param {object|function} _item - observable or computed from a given model (step)
         * @param {String} _key - key
         * @returns {*} - value
         */
        StepBase.prototype.showKeyContent = function(_item, _key)
        {
            var result,
                trimmedText,
                maxLength = 44;

            if (_.has(_item, 'filterSummary') && _.isFunction(_item.filterSummary))
            {
                return _item.filterSummary();
            }

            //handle array
            if (ko.utils.isObservableArray(_item))
            {
                result = _item.toStringByKey(_key);
            }
            //case when the item is computed and object
            else if (ko.isComputed(_item) && (_.isObject(_item()) || _.isArray(_item()) ))
            {
                result = _item.toStringByKey(_key);
            }
            else
            {
                result = _item();
            }

            // adding trim for text with max length
            trimmedText =  !_.has(_item, 'doNotTrim') && !_.isNull(result) && !_.isUndefined(result) && result.length > maxLength ? result.substring(0, maxLength - 1) + '...' : result;

            return trimmedText;
        };

        /**
         * check the field exists in the model and with data - and put it in the target
         * @param {StepBase} modelComp - the model to get the data from
         * @param {String} field - string of field key name
         * @param {Object} target - target model to change
         * @param {String} targetField - string of field key name
         * @returns {void}
         */
        StepBase.prototype.checkAndAdd = function(modelComp, field, target, targetField)
        {
            var currentValue;
            // check we have model, it has the property , the property is observable, and with value in it
            if ( modelComp && modelComp.hasOwnProperty(field) && ko.isObservable(modelComp[field]))
            {
                currentValue = modelComp[field]();
                if (
                    (_.isObject(currentValue) || _.isArray(currentValue)) &&  !_.isEmpty(currentValue)
                    || _.isFinite(+currentValue) && currentValue > 0 || _.isString(currentValue))
                {
                    target[targetField] = currentValue;
                }
            }
        };

        /**
         * This method will create new instance of stepModel (Audience, Creative etc..)
         * OR return one from the wizard.stepsModels array
         * @param {object} params - params from binding, passed from child
         * @returns {object} obj - instance of a child
         */
        StepBase.prototype.loadFromCollection = function(params)
        {
            var obj, 
                _index;
            _index = params.parent.stepsModels().indexOf(this);
            if (_index === -1)
            {
                this.__init(params);
                params.parent.stepsModels.push(this);
                obj = this;
            }
            else
            {
                obj = params.parent.stepsModels()[_index];
                obj.constructor = null;
                obj.__updateWizard.call(obj);
            }
            params.parent.currentStepModel(obj);
            return obj;
        };

        /**
         * Step Validation
         * @returns {boolean} - temp
         */
        StepBase.prototype.isStepValid = function()
        {
            return true;
        };

        /**
         * Step Validation
         * @returns {boolean} - temp
         */
        StepBase.prototype.silentValidation = function()
        {
            return true;
        };


        /**
         * return the keys of the model - without excludes
         * @param {Array} exclude - keys to exclude from array
         * @returns {Array} - keys of the model without excludes
         */
        StepBase.prototype.getKeys = function(exclude)
        {
            var keys = Object.keys(this);
            if ( _.isUndefined(exclude))
            {
                exclude = [];
            }
            exclude.push('title', 'wizard');

            return  _.filter(keys, function(key)
            {
                return exclude.indexOf( key ) < 0;
            });

        };

        /**
         * convert "thisStringIsGood" to "This String Is Good" - to be able to display in Summary page
         * @param {String} str - the string to format
         * @returns {String} - the formatted string
         */
        StepBase.prototype.formatToForm = function(str)
        {
            return str
                // insert a space before all caps
                .replace(/([A-Z])/g, ' $1')
                // uppercase the first character
                .replace(/^./, function(_str)
                {
                    return _str.toUpperCase();
                });
        };

        /**
         * Return the model to the initial state
         * This - child context
         * @returns {void}
         */
        StepBase.prototype.cleanStep = function()
        {
        };

        return StepBase;
    }
);
