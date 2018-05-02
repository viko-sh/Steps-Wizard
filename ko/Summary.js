/*global __g_sm, ko, _, _campaignID, Tracx, Q*/

define(
    [
        'resource!ko/components/boost/Wizard/StepBase'
    ],
    function(StepBase)
    {
        'use strict';

        var instance;

        /**
         * Constructor
         * @constructor
         * @returns {void}
         */
        function Summary()
        {
            this.title              = 'Summary';

            this.titleSummary       = ko.pureComputed(this.__titleSummary, this).extend({'showOnSummary': false});
            this.estimatedReach     = ko.observable(null); //ko.pureComputed(this.__calculateEstimateReach, this).extend({async: this.__estimatedReachFulfilled, 'showOnSummary': true});
        }

        //inherit from StepBase
        Summary.augments(StepBase);

        /**
         * tooltip function
         * @returns null - the tooltip string to show in the progress bar
         * @private
         */
        Summary.prototype.__titleSummary = function()
        {
            return null; // we have no title in summary page
        };

        Summary.prototype.stepEnter = function()
        {
            this.__calculateEstimateReach();
        };

        /**
         * computed function that will calculate the estimate reach based on the targeting / owner/ ad account, etc.
         * @private
         * @returns {void|null}
         */
        Summary.prototype.__calculateEstimateReach = function()
        {
            var data = null,
                currency,
                audienceData,
                deferred = Q.defer(),
                audienceModel = this.wizard.getStepModelByName('Audience'),
                budgetModel = this.wizard.getStepModelByName('Budget'),
                creative = this.wizard.getStepModelByName('Creative'),
                _selectedAdAccountID = this.wizard.selectedAdAccount(),
                adAccountID = (ko.isObservable(this.wizard.selectedAdAccount) && !_.isEmpty(this.wizard.selectedAdAccount()) ) ? this.wizard.selectedAdAccount().adAccountID() : null,
                postID      = !_.isUndefined(this.wizard.selectedPostID) ? this.wizard.selectedPostID : null;

            if (_.isUndefined(_selectedAdAccountID) || _.isNull(_selectedAdAccountID) || _.isEmpty(budgetModel.optimizationForAdDelivery()))
            {
                return null;
            }
            currency = this.wizard.selectedAdAccount().currency();

            audienceData = audienceModel.getData();

            // check we have geo location data , else don`t try to estimate
            if ( !_.has(audienceData, 'targetCountries') && !_.has(audienceData, 'targetCities') && !_.has(audienceData, 'targetStates'))
            {
                return null;
            }

            data  = {
                format: 'json',
                magic: __g_sm,
                adAccountID: adAccountID,
                targeting: ko.utils.stringifyJson(audienceData),
                creative: creative.getData(),
                currency: currency,
                postID: postID,
                billingEvent: budgetModel.whenYouGetCharged(),
                optimization: budgetModel.optimizationForAdDelivery(), //'POST_ENGAGEMENT',
                ownerID: this.wizard.getOwnerID(adAccountID)
            };
            this.wizard.__serverCall('/internal/PaidBoostApi/getEstimatedReach', data, deferred);
            deferred.promise.then(this.__estimatedReachFulfilled.bind(this));
        };

        /**
         * @param {object} _data - the getEstimatedReach callback for success data
         * @private
         * @returns {void}
         */
        Summary.prototype.__estimatedReachFulfilled = function(_data)
        {
            this.estimatedReach(_data.users);
        };

        /**
         * Applying the single tone pattern
         * @type {Summary}
         */
        instance = new Summary();


        Summary.prototype.stepInit = function()
        {
            this.__calculateEstimateReach();
        };

        /**
         * Calls the server to boost this post
         * @returns {void}
         */
        Summary.prototype.submit = function()
        {
            var adAccountID,
                postID,  // post should be in the format of pageID_postID
                ownerID,
                audienceModel = this.wizard.getStepModelByName('Audience'),
                BudgetModel = this.wizard.getStepModelByName('Budget'),
                CampaignModel = this.wizard.getStepModelByName('Campaign'),
                Creative = this.wizard.getStepModelByName('Creative'),
                deferred = Q.defer(),
                adCreativeID,
                data;

            // Set mandatory data for boosting
            adAccountID = (ko.isObservable(this.wizard.selectedAdAccount) && !_.isEmpty(this.wizard.selectedAdAccount()) ) ? this.wizard.selectedAdAccount().adAccountID() : null;
            postID      = !_.isUndefined(this.wizard.selectedPostID) ? this.wizard.selectedPostID : null;
            ownerID = this.wizard.getOwnerID(adAccountID);
            adCreativeID = this.wizard.adCreativeID;

            // Check that all data exists prior to sending to the server
            if (!_.isNull(adCreativeID) && !_.isNull(adAccountID) && !_.isNull(postID) && audienceModel.isStepValid() && BudgetModel.isStepValid())
            {
                data  = {
                    campaignID: _campaignID,
                    adAccountID: adAccountID,
                    campaign: CampaignModel.getData(),
                    target: audienceModel.getData(),
                    budget: BudgetModel.getData(),
                    creative: Creative.getData(),
                    postID: postID,
                    ownerID: ownerID,
                    contentID: this.wizard.contentID,
                    adCreativeID: adCreativeID
                };

                data = {
                    format: 'json',
                    magic: __g_sm,
                    data: JSON.stringify(data)
                };

                this.startLoadingGorilla();
                this.wizard.__serverCall('/internal/PaidBoostApi/boost', data, deferred);
                deferred.promise.then(this.boostSuccess.bind(this)).fail(this.boostFailure.bind(this));
            }

            else
            {
                Tracx.notifications.notify(Tracx.NotificationEnum.Type.ERROR, 'Some parameters are missing, please make sure you filled in all the details.', 'medium');
            }

        };

        Summary.prototype.boostFailure = function(failure)
        {
            var severity = Tracx.NotificationEnum.Type.ERROR;
            Tracx.notifications.notify(severity, failure.message, 'medium');
            this.stopLoadingGorilla();
        };

        Summary.prototype.boostSuccess = function(message)
        {
            Tracx.notifications.notify(Tracx.NotificationEnum.Type.SUCCESS, message, 'medium');
            this.wizard.cancel();
            this.stopLoadingGorilla();
            $.SrmSideBar.toggle('close', 'AdsSideBar');
        };

        Summary.prototype.startLoadingGorilla = function()
        {
            this.wizard.element.append("<div class='loadingGorilla highOpacity'></div>");
        };

        Summary.prototype.stopLoadingGorilla = function()
        {
            this.wizard.element.find('.loadingGorilla').remove();
        };

        /**
         * Return the model to the initial state
         * @returns {void}
         */
        Summary.prototype.cleanStep = function()
        {

        };

        /**
         * Get current instance of Audience
         * the instance can be new || already initialized and stored in Wizard.stepsModels
         * @param {object} params - params from binding
         * @returns {object} - Summary
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
