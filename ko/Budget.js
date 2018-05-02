/*global __g_sm, ko, _, _campaignID, Tracx, moment, _campaignTimeZone, _campaignDateFormat, Q */
define(
    [
        'resource!ko/components/boost/Wizard/StepBase',
        'resource!moment',
        'resource!ko/knockout-fdatepicker'
    ],
    function(StepBase, moment)
    {
        'use strict';

        var instance;

        /**
         * Constructor
         * @constructor
         * @returns {void}
         */
        function Budget()
        {
            this.title              = 'Budget';
            this.lifeTimeBudget     = ko.observable(null).extend({ decimal: 2,
                pattern: {
                    message: 'The value must be a number',
                    params: /^[0-9]+([,.][0-9]*)?$/
                }
            }).extend({'showOnSummary': true, hasChanges: false});
            this.startDate          = ko.observable(null).extend({'showOnSummary': true, hasChanges: false}).withPausing();
            this.endDate            = ko.observable(null).extend({'showOnSummary': true, hasChanges: false}).withPausing();
            this.offset             = ko.observable(null).extend({'showOnSummary': false, hasChanges: false});
            this.campaignDateFormat = ko.observable().extend({'showOnSummary': false});
            this.bidType            = ko.observable().extend({'showOnSummary': false});
            this.bidAmountManual    = ko.observable().extend({'showOnSummary': false}).extend(
                {
                    decimal: { params: 2, message: 'Number should be up to 2 digits' },
                    min: 0.01,
                    pattern: {
                        message: 'The value must be a number',
                        params: /^[0-9]+([,.][0-9]*)?$/
                    },
                    hasChanges: false
                });
            this.bidValidation              = ko.pureComputed(this.__bidValidation, this).extend({'showOnSummary': false});
            this.bidAmount                  = ko.pureComputed(this.__bidAmountToText, this).extend({'showOnSummary': true, doNotTrim: true});

            this.adDeliveryOptions          = [{id: 'POST_ENGAGEMENT', text: 'Post Engagement'}, {id: 'IMPRESSIONS', text: 'Impressions'}, {id: 'REACH', text: 'Daily Unique Reach'}];
            this.optimizationForAdDelivery  = ko.observable().extend({'showOnSummary': true, filterOnSummary: this.__filterOptimizationForAdDelivery.bind(this), doNotTrim: true });
            this.billingEventOptions        = ko.observableArray().extend({'showOnSummary': false});
            this.whenYouGetCharged          = ko.observable().extend({'showOnSummary': true, filterOnSummary: this.__filterBillingEvent.bind(this), doNotTrim: true});

            this.dateFormat         = this.getTimezoneFormat();
            this.timezone           = (!_.isUndefined(_campaignTimeZone)) ? _campaignTimeZone : 0;
            this.minDate            = null;

            this.endDate.subscribeChanged(this.__endDateChanged, this);
            this.optimizationForAdDelivery.subscribe(this.__optiomizationGoalChanged, this);
            this.bidType.subscribe(this.__bidTypeChanged, this);

            // summary title
            this.titleSummary       = ko.pureComputed(this.__titleSummary, this).extend({'showOnSummary': false});
            this.currencyIcon       = ko.pureComputed(this.__getCurrencyIcon, this).extend({'showOnSummary': false});
        }

        //inherit from StepBase
        Budget.augments(StepBase);

        /**
         * set bid amount manual by the bid type selection
         * also reset the bidAmountManual validation error
         * @param {int} status - the status selected for the bid
         * @private
         * @return {void}
         */
        Budget.prototype.__bidTypeChanged = function(status)
        {
            if (status === this.wizard.ENUMS.BID.AUTO)
            {
                this.bidAmountManual(undefined);
            }
            this.bidAmountManual.isModified(false);
        };

        /**
         * Returns the text value from selected ad delivery
         * @return {string} - option text
         * @private
         */
        Budget.prototype.__filterOptimizationForAdDelivery = function()
        {
            var selectedItemID = this.optimizationForAdDelivery(),
                selectedItem = _.where(this.adDeliveryOptions, {id: selectedItemID});
            return selectedItem[0].text;
        };

        /**
         * optimization goal effects the possible options a user can pick billing event.
         * https://developers.facebook.com/docs/marketing-api/validation/v2.8#opt_bids
         * @param _value
         * @private
         * @return {void}
         */
        Budget.prototype.__optiomizationGoalChanged = function(_value)
        {
            if ( _value === this.adDeliveryOptions[0].id) // optimization goal == POST_ENGAGEMENT ?
            {
                this.billingEventOptions([{id: 'POST_ENGAGEMENT', text: 'Post Engagement'}, {id: 'IMPRESSIONS', text: 'Impressions'}]);
            }
            else
            {
                this.billingEventOptions([{id: 'IMPRESSIONS', text: 'Impressions'}]);
            }
        };

        /**
         * Returns the text value from billingEventOptions by the selected billing event ID
         * @return {string} - option text
         * @private
         */
        Budget.prototype.__filterBillingEvent = function()
        {
            var selectedItemID = this.whenYouGetCharged(),
                selectedItem = _.where(this.billingEventOptions(), {id: selectedItemID});
            if ( !_.isEmpty(selectedItem))
            {
                return selectedItem[0].text;
            }
            else
            {
                return this.billingEventOptions()[0].text;
            }
        };

        /**
         * Validate Bid Amount field
         * @returns {bool} - if the value is valid or not
         * @private
         */
        Budget.prototype.__bidValidation = function()
        {
            if (this.bidType() === this.wizard.ENUMS.BID.AUTO)
            {
                return true;
            }

            return this.bidAmountManual.isModified() && this.bidAmountManual.isValid();
        };

        /**
         * Convert bid type to string, with bid amount value, in case of manual bid
         * @returns {string} - bid type description
         * @private
         */
        Budget.prototype.__bidAmountToText = function()
        {
            var bidType = this.bidType(),
                bidAmount = this.bidAmountManual();

            if (bidType === this.wizard.ENUMS.BID.MANUAL)
            {
                return '<span>Manual</span> <i class="tr-icon-' + this.currencyIcon().returnData + '"></i>' + bidAmount;
            }
            return 'Auto';
        };

        /**
         * verify the end date is later then start date , if not display info and return the old value.
         * @param newValue
         * @param oldValue
         * @private
         */
        Budget.prototype.__endDateChanged = function(newValue, oldValue)
        {
            var _newEndDate = moment(newValue, this.dateFormat),
                _startDate = moment(this.startDate(), this.dateFormat);
            if ( !_newEndDate.isAfter(_startDate)) // newValue === this.startDate())
            {
                this.endDate(oldValue); // put old date back
                Tracx.notifications.notify(Tracx.NotificationEnum.Type.INFO, 'End date must be later than Start date.', 'medium');
            }
        };

        /**
         * @private
         * @returns {string} - the object of the currency to be used.
         */
        Budget.prototype.__getCurrencyIcon = function()
        {
            var currency,
                map = ['ILS', 'USD', 'AUD', 'EUR'],
                result,
                returnData,
                isMapped = false;

            if (!_.isUndefined(this.wizard.selectedAdAccount()))
            {
                currency = this.wizard.selectedAdAccount().currency();
            }

            if (!_.isUndefined(currency))
            {
                result = _.where(map, currency);
                if (result.length)
                {
                    returnData = result[0].toLowerCase();
                    isMapped = true;
                }
                else
                {
                    returnData = currency;
                }
            }

            return {
                isMapped: isMapped,
                returnData: returnData
            };
        };

        /**
         * @returns {XML|string}
         */
        Budget.prototype.getTimezoneFormat = function()
        {
            return _campaignDateFormat.replace('m', 'MM').replace('d', 'DD').replace('Y', 'YYYY');
        };

        /**
         * Init this step, this method will be invoke from StepBase
         * @returns {void}
         */
        Budget.prototype.stepInit = function()
        {
            // set minimum date for the date picker
            this.minDate = moment(moment.utc(), this.timezone).format(this.dateFormat);
            this.startDate(moment(moment.utc(), this.timezone).format(this.dateFormat));
            this.startDate.resetChanges();
            this.endDate(moment(moment.utc().add(7, 'days'), this.timezone).format(this.dateFormat));
            this.endDate.resetChanges();
            this.offset(+this.wizard.selectedAdAccount().offset());
            this.offset.resetChanges();
            this.lifeTimeBudget.extend({
                required: true,
                min: 1
            });
            this.bidType(this.wizard.ENUMS.BID.AUTO);
        };

        /**
         * return all the budget data formatted ready for boost
         * @returns {Object} - all budget data
         */
        Budget.prototype.getData = function()
        {
            var result = {};

            this.checkAndAdd(this, 'lifeTimeBudget', result, 'lifeTimeBudget');
            this.checkAndAdd(this, 'offset', result, 'offset');
            this.checkAndAdd(this, 'startDate', result, 'startDate');
            this.checkAndAdd(this, 'endDate', result, 'endDate');
            this.checkAndAdd(this, 'bidType', result, 'bidType');
            this.checkAndAdd(this, 'bidAmountManual', result, 'bidAmountManual');
            this.checkAndAdd(this, 'optimizationForAdDelivery', result, 'optimizationGoal');
            this.checkAndAdd(this, 'whenYouGetCharged', result, 'billingEvent'); // billingEvent
            return result;
        };

        /**
         * Return the model to the initial state
         * @returns {void}
         */
        Budget.prototype.cleanStep = function()
        {
            this.lifeTimeBudget(null);
            this.lifeTimeBudget.resetChanges();
            this.lifeTimeBudget.isModified(false);
            this.startDate(moment(moment.utc(), this.timezone).format(this.dateFormat));
            this.startDate.resetChanges();
            this.endDate(moment(moment.utc().add(7, 'days'), this.timezone).format(this.dateFormat));
            this.endDate.resetChanges();
            this.bidType(this.wizard.ENUMS.BID.AUTO);
            this.bidAmountManual(null);
            this.bidAmountManual.resetChanges();
            this.optimizationForAdDelivery(this.adDeliveryOptions[0].id);
        };

        /**
         * Applying the single tone pattern
         * @type {Budget}
         */
        instance = new Budget();

        /**
         * Step Validation
         * @returns {boolean} - validation result
         */
        Budget.prototype.isStepValid = function()
        {
            var isValid = true;

            this.lifeTimeBudget.isModified(true);

            //check life time budget value
            if (!this.lifeTimeBudget.isValid())
            {
                isValid = false;
            }

            this.bidAmountManual.isModified(true);
            //check bid amount value
            if (this.bidType() == this.wizard.ENUMS.BID.MANUAL && !this.bidAmountManual.isValid())
            {
                isValid = false;
            }

            return isValid;
        };


        /**
         *
         * @returns {boolean}
         */
        Budget.prototype.silentValidation = function()
        {
            var isValid = true;

            if (!this.lifeTimeBudget.isValid())
            {
                isValid = false;
            }

            return isValid;
        };

        /**
         * Sets the end date 7 days after _date
         * @param {string} _date - date
         * @returns {void}
         */
        Budget.prototype.dateChangeCallback = function(_date)
        {
            var date = moment(_date, this.dateFormat).add(7, 'days');
            this.endDate(date.format(this.dateFormat));
        };

        /**
         * Get current instance of Audience
         * the instance can be new || already initialized and stored in Wizard.stepsModels
         * @param {object} params - params from binding
         * @returns {object} - Budget
         */
        function getInstance(params)
        {
            return instance.loadFromCollection.call(instance, params);
        }

        return {
            viewModel: {
                createViewModel: getInstance
            }
        };
    }
);
