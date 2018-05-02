/*global __g_sm, ko, _, _campaignID, Tracx, Q, _campaignDateFormat, $, _campaignTimeZone */
define(
    [
        'resource!ko/components/boost/Wizard/StepBase'
    ],
    function(StepBase)
    {
        'use strict';

        var instance;

        /**
         * step constructor
         * @constructor
         */
        function Campaign()
        {
            this.title = 'Campaign';

            this.tabsInstance = ko.observable(null).extend({'showOnSummary': false});
            this.selectedTabs = ko.observableArray().extend({'showOnSummary': false});
            this.currentTab = ko.observable().extend({'showOnSummary': false});

            // tab 1
            this.name = ko.observable('').extend({'showOnSummary': true}).extend({
                required: { message: 'Required Field' },
                minLength: 1,
                maxLength: 400,
                pattern: {
                    message: 'Using \'@\' in first char is not allowed in campaign name',
                    params: /^[^@][\S\s]*$/
                }
            });

            // tab 2
            this.campaigns = ko.observableArray([]).extend({'showOnSummary': false});
            this.selectedExternalCampaign = ko.observable().extend({'showOnSummary': false}).extend({
                required: { message: 'Required Field' }
            });
            this.adSetName = ko.observable('').extend({'showOnSummary': true}).extend({
                required: { message: 'Required Field' },
                minLength: 1,
                maxLength: 400,
                pattern: {
                    message: 'Using \'@\' in first char is not allowed in adset name',
                    params: /^[^@][\S\s]*$/
                }
            });


            this.selectedExternalCampaign.subscribe(this.__selectedExternalCampaignChange, this);
            this.currentTab.subscribe(this.__selectedCurrentTabChange, this);

            this.titleSummary = ko.pureComputed(this.__titleSummary, this).extend({'showOnSummary': false});
        }

        //inherit from StepBase
        Campaign.augments(StepBase);

        Campaign.prototype._TABS = [
            {
                text: 'Create New Campaign',
                selected: true
            },
            {
                text: 'Create Ad Set',
                selected: false
            }
        ];

        Campaign.prototype.onTabChange = function(activeTab)
        {
            this.currentTab(activeTab.text);
            this.selectedTabs.removeAll();
            this.selectedTabs.pushAll(activeTab);
        };

        /**
         * Init this step, this method will be invoke from StepBase
         * @returns {void}
         */
        Campaign.prototype.stepInit = function()
        {
            // create computed that will fetch current campaigns when ad account changes
            if ( !_.isUndefined(this.wizard.selectedAdAccount()) && !_.isNull(this.wizard.selectedAdAccount()))
            {
                this.getCampaigns(this.wizard.selectedAdAccount());
            }
            this.wizard.selectedAdAccount.subscribe(this.getCampaigns, this);
        };

        /**
         * Return the model to the initial state
         * @returns {void}
         */
        Campaign.prototype.cleanStep = function()
        {
            this.tabsInstance().reset([this._TABS[0]]);
            this.name('');
            this.selectedExternalCampaign(undefined);
            this.adSetName('');
            this.adSetName.isModified(false);
            this.selectedExternalCampaign.isModified(false);
            this.name.isModified(false);
        };

        Campaign.prototype.__selectedCurrentTabChange = function(_tab)
        {
            this.adSetName('');
            this.name('');
            this.selectedExternalCampaign(undefined);

            this.adSetName.isModified(false);
            this.selectedExternalCampaign.isModified(false);
            this.name.isModified(false);
        };

        Campaign.prototype.__selectedExternalCampaignChange = function(_newcampaignID)
        {
            var selectedCampaign = null;

            if ( _.isNull(_newcampaignID) || _.isUndefined(_newcampaignID))
            {
                this.name(null);
                return;
            }

            // need to set the campaign Name by the selected campaign ID
            selectedCampaign = ko.utils.arrayFirst(this.campaigns(), function(_campaign)
            {
                if ( _campaign.id === _newcampaignID )
                {
                    return true;
                }
            });

            if ( !_.isNull(selectedCampaign))
            {
                this.name(selectedCampaign.name);
            }
            else
            {
                this.name('');
            }
        };

        /**
         * Step Validation
         * @returns {boolean} - validation result
         */
        Campaign.prototype.isStepValid = function()
        {
            var isValid = true;

            if ( this.currentTab.peek() === this._TABS[1].text && !this.selectedExternalCampaign.isValid())
            {
                isValid = false;
                this.selectedExternalCampaign.isModified(true);
            }

            if (!this.adSetName.isValid())
            {
                isValid = false;
                this.adSetName.isModified(true);
            }

            // check name ( campaign name )  is valid only if the selected tab is 'Create New Campaign'
            if (this.currentTab.peek() === this._TABS[0].text && !this.name.isValid())
            {
                isValid = false;
                this.name.isModified(true);
            }

            return isValid;
        };

        Campaign.prototype.silentValidation = function()
        {
            var isValid = true;

            if ( this.currentTab.peek() === this._TABS[1].text && !this.selectedExternalCampaign.isValid())
            {
                isValid = false;
            }

            if (!this.adSetName.isValid())
            {
                isValid = false;
            }

            if (!this.name.isValid())
            {
                isValid = false;
            }

            return isValid;
        };

        /**
         * get campaigns from api - by the select ad account, also listen to selected ad account changes
         */
        Campaign.prototype.getCampaigns = function(_adAccount)
        {
            //in case _adAccountID is not what we expect him to be, just return
            if (_.isNull(_adAccount) || _.isUndefined(_adAccount))
            {
                return;
            }

            var deferred = Q.defer(),
                data,
                ownerID,
                adAccountID = +_adAccount.adAccountID();

            if ( _.isUndefined(adAccountID))
            {
                this.campaigns([]);
                return;
            }

            ownerID = this.wizard.getOwnerID(adAccountID);
            //if we dont have ownerID, we can stop the code here
            if (_.isNull(ownerID))
            {
                return;
            }

            this.campaigns([]);
            // get the list of campaign for the current ad account.
            data = {
                format: 'json',
                magic: __g_sm,
                adAccountID: adAccountID,
                ownerID: ownerID
            };

            this.wizard.__serverCall('/internal/PaidBoostApi/getCampaigns', data, deferred);

            deferred.promise.then(function(_data)
            {
                this.campaigns([]);
                this.campaigns.pushAll(_data);
            }.bind(this));

            deferred.promise.fail(function(error)
            {
                this.campaigns([]);
            }.bind(this));
        };

        /**
         * @returns {{}}
         */
        Campaign.prototype.getData = function()
        {
            var result = {};

            // check the current selection , and send campaign name or campaign ID & ad set name
            if ( this.currentTab() === this._TABS[0].text)
            {
                result['campaignType'] = 0;
                this.checkAndAdd(this, 'name', result, 'campaignName');
            }
            else
            {
                result['campaignType'] = 1;
                result['externalCampaignID'] = this.selectedExternalCampaign();
            }
            this.checkAndAdd(this, 'adSetName', result, 'adsetName');

            return result;
        };



        instance = new Campaign();

        /**
         * return a new instance or the existing instance
         * @param {object} params -
         * @returns {Campaign|object} -
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
