define(
    [
        'resource!boost/settings/PaidBoostAccount',
        'resource!models/Audience',
        'resource!ko/knockout-multiselect',
        'resource!ko/knockout-utils'
    ],
    function(PaidBoostAccount, AudienceModel)
    {
        'use strict';

        ko.extenders.showOnSummary = function(target, option)
        {
            target.showOnSummary = ko.observable(option);
            return target;
        };

        ko.extenders.filterOnSummary = function(target, option)
        {
            target.filterSummary = option;
            return target;
        };

        ko.extenders.doNotTrim = function(target, option)
        {
            target.doNotTrim = option;
            return target;
        };


        /**
         *  Wizard for steps flow - constructor
         * @param {object} _options - wizard options
         * @constructor
         */
        function StepsWizard(_options)
        {
            this.title = ko.observable(undefined);
            this.accounts = ko.observableArray([]);
            this.selectedAdAccount = ko.observable().extend({previousValue: true});
            this.stepsArr = ko.observableArray(_options.steps);
            this.stepsModels = ko.observableArray([]);
            this.currentStep = ko.observable(this.stepsArr()[0]);
            this.currentStepModel = ko.observable();
            this.submitButtonText = ko.observable(_options.submitButtonText);
            this.submitButtonFuncName = ko.observable(_options.submitButtonFuncName);
            this.element = _options.element;
            this.selectedPostID = null;
            this.selectedPageOwnerID = null;
            this.selectedProfileOwnerID = null;
            this.adCreativeID = null;
            this.instagramActorID = null;

            //computed functions
            this.currentIndex = ko.pureComputed(this.__currentIndex, this);
            this.canGoPrevious = ko.pureComputed(this.__canGoPrevious, this);
            this.isLastStep = ko.pureComputed(this.__isLastStep, this);
            this.cannotSwitchAccount = ko.pureComputed(this.__canNotSwitchAccount, this);

            //enums
            this.ENUMS = {
                AUTOCOMPLETE: {
                    LOCATION: 'location',
                    LANGUAGE: 'language',
                    INTEREST: 'Interest'
                },
                LIMITS: {
                    COUNTRIES: 50,
                    CITIES: 250,
                    STATES: 250,
                    LANGUAGE: 50,
                    INTERESTS: 400
                },
                BID: {
                    AUTO: 1,
                    MANUAL: 2
                },
                CREATIVE: {
                    TABS: {
                        MOBILE: {text: 'Mobile', type: 'MOBILE_FEED_STANDARD'},
                        DESKTOP: {text: 'Desktop', type: 'DESKTOP_FEED_STANDARD'},
                        DESKTOP_RIGHT_COLUMN: {text: 'Desktop Right Column', type: 'RIGHT_COLUMN_STANDARD'},
                        INSTAGRAM_FEED: {text: 'Instagram Feed', type: 'INSTAGRAM_STANDARD'}
                    }
                }
            };

            this.selectedAdAccount.subscribe(this.selectedAdAccountChanged, this);
        }

        StepsWizard.prototype.selectedAdAccountChanged = function(adAccount)
        {
            if (!_.isUndefined(adAccount))
            {
                // check if we have changes in the flow -> if so , ask if user allow to reset, then cleanSteps. else cancel
                if ( this.hasChanges() )
                {
                    // display question
                    this._discardChanges(adAccount);
                }
                this.initAudiences(adAccount);
                this.getCreativeID();
            }
        };

        StepsWizard.prototype._discardChanges = function(adAccount)
        {
            this.initAudiences.call(this, adAccount);
            // ad account was changed - and we reset all values
            ko.utils.arrayForEach(this.stepsModels(), function(_model)
            {
                _model.cleanStep();
            });
            this.currentStep(this.stepsArr()[0]);
        };

        /**
         * callback function that runs before we ask the client if he is sure changing the ad account
         * called from confirmValue binding ( in knockout-utils.js )
         */
        StepsWizard.prototype.beforeConfirm = function()
        {
            var waitingConfirmation = true;
            this.loading(waitingConfirmation);
        };

        StepsWizard.prototype.afterConfirm = function()
        {
            var waitingConfirmation = true;
            this.finishLoading(waitingConfirmation);
        };

        /**
         * go over all the steps , and check if we have changes
         */
        StepsWizard.prototype.hasChanges = function()
        {
            var _changes = false;
            ko.utils.arrayForEach(this.stepsModels(), function(_model)
            {
                // get all model parameters we need to check
                ko.utils.arrayFirst(_model.getKeys(), function(key)
                {
                    if ( ko.isObservable(_model[key]) && _.has(_model[key], 'wasChanged') && _model[key].wasChanged())
                    {
                        _changes = true;
                    }
                });
            });
            return _changes;
        };

        /**
         * Get the first Owner id
         * @param {string} _adAccountID - ad account id
         * @returns {object|*} - if
         */
        StepsWizard.prototype.getProfileOwnerIdByAdAccountID = function(_adAccountID)
        {
            return ko.utils.arrayFirst(this.accounts(), function(_account)
            {
                return +_account.adAccountID() === +_adAccountID;
            });
        };

        StepsWizard.prototype.loading = function(waitingConfirmation)
        {
            if (!_.isUndefined(waitingConfirmation) && waitingConfirmation)
            {
                this.element.append('<div class="waitingConfirmation"></div>');
            }
            else
            {
                this.element.append('<div class="loadingGorilla"></div>');
            }
        };

        StepsWizard.prototype.finishLoading = function(waitingConfirmation)
        {
            if (!_.isUndefined(waitingConfirmation) && waitingConfirmation)
            {
                this.element.find('.waitingConfirmation').remove();
            }
            else
            {
                this.element.find('.loadingGorilla').remove();
            }
        };

        /**
         * This method making sure that user can switch ad account only on the first step
         * Pure Computed
         * @returns {boolean}
         * @private
         */
        StepsWizard.prototype.__canNotSwitchAccount = function()
        {
            var current = this.currentIndex();
            return current !== 0;
        };

        /**
         * get list of accounts from server and save them on accounts array
         * @returns {Q} deferred
         */
        StepsWizard.prototype.getAccounts = function()
        {
            var deferred = Q.defer(),
                self = this,
                data;

            data = {
                format: 'json',
                magic: __g_sm,
                campaignID: _campaignID,
                pageOwnerID: this.selectedPageOwnerID
            };

            this.__serverCall(END_POINTS.GET_ACCOUNTS, data, deferred);

            deferred.promise
                .then(self.initAdAccounts.bind(self));
        };

        /**
         * Get Owner ID
         * @param {int|null} adAccountID - ad account id
         * @returns {int|null} - owner id or null
         */
        StepsWizard.prototype.getOwnerID = function(adAccountID)
        {
            var selectedAdAccountOwnerID,
                ownerID;
            //in case _adAccountID is not what we expect him to be, just return
            if (_.isNull(adAccountID) || _.isUndefined(adAccountID))
            {
                return null;
            }
            selectedAdAccountOwnerID = this.getProfileOwnerIdByAdAccountID(adAccountID);
            _.each(this.adsData, function(adData)
            {
                // check page is the same && ad account match
                if ( +adData.pageOwnerID === +this.selectedPageOwnerID && +adData.ownerID === +selectedAdAccountOwnerID.ownerID())
                {
                    ownerID = adData.ownerID;
                }
            }.bind(this));

            return ownerID;
        };

        /**
         * Init custom audiences by
         * @param {int} _adAccountID - ad account id
         * @returns {void}
         */
        StepsWizard.prototype.initAudiences = function(_adAccountID)
        {
            //in case _adAccountID is not what we expect him to be, just return
            if (_.isNull(_adAccountID) || _.isUndefined(_adAccountID))
            {
                return;
            }

            var deferred = Q.defer(),
                self = this,
                data = {
                    format: 'json',
                    magic: __g_sm,
                    adAccountID: +_adAccountID.adAccountID()
                };

            self.__serverCall(END_POINTS.GET_AUDIENCES, data, deferred);

            deferred.promise.then(
                function(_data)
                {
                    var mapping;
                    //data empty, exit the function
                    if (_.isEmpty(_data))
                    {
                        self.selectedAdAccount().audiences.removeAll();
                        return;
                    }
                    //get the audience model

                    mapping = {
                        create: function(options)
                        {
                            return new AudienceModel(options.data);
                        }
                    };
                    //data modeling
                    if ( !_.isUndefined(self.selectedAdAccount()))
                    {
                        ko.mapping.fromJS(_data, mapping, self.selectedAdAccount().audiences);
                    }

                });
        };


        /**
         *
         * @param _data
         */
        StepsWizard.prototype.initAdAccounts = function(_data)
        {
            var _temp = [];
            _.each(_data, function(accountData)
            {
                _temp.push( new PaidBoostAccount(accountData, 6));
            });
            this.accounts.removeAll();
            this.accounts.pushAll(_temp);
        };

        /**
         * computed function - index of current step in steps array
         * @returns {*|Number|number|integer} -
         * @private
         */
        StepsWizard.prototype.__currentIndex = function()
        {
            return this.stepsArr.indexOf(this.currentStep());
        };

        /**
         * pure computed function - telling us if the client has more steps in the wizard
         * @returns {boolean} -
         * @private
         */
        StepsWizard.prototype.canGoNext = function()
        {
            var isValid = false,
                currentModel = this.currentStepModel();

            if (this.currentIndex() < this.stepsArr().length - 1)
            {
                isValid = true;
            }

            if (!_.isUndefined(currentModel))
            {
                isValid = currentModel.isStepValid();
                // isValid = true; // step doesn't have to contain anything in order to click next (bug #135 Jira)
            }

            return isValid;
        };

        /**
         * pure computed function - telling us if the client has previous steps in the wizard
         * @returns {boolean} -
         * @private
         */
        StepsWizard.prototype.__canGoPrevious = function()
        {
            return this.currentIndex() > 0;
        };

      /**
         * pure computed function - telling us if this is the last step in the wizard
         * @returns {boolean}
         * @private
         */
        StepsWizard.prototype.__isLastStep = function()
        {
            return this.currentIndex() === this.stepsArr().length - 1;
        };

        /**
         * return the number of step the client is in. to display in the UX
         * @returns {*} -
         */
        StepsWizard.prototype.getReadableIndex = function()
        {
            return this.stepsArr.indexOf(this.currentStep()) + 1;
        };

        /**
         * change the current step by the index given.
         * @param index - number of step to go to
         * @return {void}
         */
        StepsWizard.prototype.goToIndex = function(index)
        {
            //if we going back, we don't need to validate
            var currentIndex = ko.unwrap(this.currentIndex());
            var goToStep =  ko.unwrap(index);
            var stop = false,
                models,
                model;
            //current step and goToStep are the same, do nothing
            if (currentIndex === goToStep)
            {
                return;
            }

            //the user want to go back, validation is not needed
            if (currentIndex > goToStep )
            {
                this.currentStep(this.stepsArr()[ko.unwrap(index)]);
            }
            //to user want to go further, we need to validate current step
            else
            {
                //prevent the user from skipping steps
                if (goToStep > this.stepsModels().length)
                {
                    this.currentStepModel().isStepValid();
                    return;
                }

                //user trying to go to next step, validate just the current step
                if ( (goToStep - currentIndex) === 1 && this.currentStepModel().isStepValid())
                {
                    this.currentStep(this.stepsArr()[goToStep]);
                    if ( this.currentStepModel().title === this.currentStep() &&  _.isFunction(this.currentStepModel()['stepEnter']))
                    {
                        this.currentStepModel()['stepEnter'].call(this.currentStepModel());
                    }
                    return;
                }

                //user trying to skip steps
                models = this.stepsModels();

                for (model in models)
                {
                    if (!models[model].silentValidation())
                    {
                        stop = true;
                        break;
                    }
                }

                if (!stop && this.currentStepModel().isStepValid())
                {
                    this.currentStep(this.stepsArr()[goToStep]);
                    if ( this.currentStepModel().title === this.currentStep() &&  _.isFunction(this.currentStepModel()['stepEnter']))
                    {
                        this.currentStepModel()['stepEnter'].call(this.currentStepModel());
                    }
                }
            }

        };

        /**
         * go to the next step in the wizard
         * @return {void} -
         */
        StepsWizard.prototype.goNext = function()
        {
            // display gorilla
            this.loading();
            if (this.canGoNext())
            {
                this.currentStep(this.stepsArr()[this.currentIndex() + 1]);
                // here our currentStepModel has not changed yet ...
                if ( this.currentStepModel().title === this.currentStep() &&  _.isFunction(this.currentStepModel()['stepEnter']))
                {
                    this.currentStepModel()['stepEnter'].call(this.currentStepModel());
                }
            }
            this.finishLoading();
        };

        /**
         * Gets the full post ID of the published post, from the publish markup.
         * In case it somehow don't get the ID -  post id will remain null.
         * @param {int} fullPostID - the full post id (< pageID > _ < postID > )that was published
         * @param {int} pageOwnerID - the owner id that published the post
         * @param profileOwnerID
         * @param adsData
         * @returns {void}
         */
        StepsWizard.prototype.setPostBoostIDAndOpenWizard = function(fullPostID, pageOwnerID, profileOwnerID, adsData, contentID)
        {
            this.currentStep(this.stepsArr()[0]);
            this.reset();
            // Only open the boost wizard in case a post was published
            this.selectedPageOwnerID    = pageOwnerID;
            this.selectedProfileOwnerID = profileOwnerID;
            this.selectedPostID         = fullPostID;
            this.adsData                = adsData;
            this.contentID              = contentID;
            this.getAccounts();
            $.SrmSideBar.toggle('open', 'AdsSideBar');
        };


        /**
         * Get Creative id from facebook api
         * We will use this id later for generate preview links
         * @returns {void}
         */
        StepsWizard.prototype.getCreativeID = function()
        {
            var deferred = Q.defer(),
                adAccountID,
                postID,
                ownerID,
                pageOwnerID,
                data;
            //get the must params for this request
            adAccountID = (ko.isObservable(this.selectedAdAccount) && !_.isEmpty(this.selectedAdAccount()) ) ? this.selectedAdAccount().adAccountID() : null;
            postID      = !_.isUndefined(this.selectedPostID) ? this.selectedPostID : null;
            ownerID = this.getOwnerID(adAccountID);
            pageOwnerID = this.selectedPageOwnerID;

            if (_.isNull(ownerID) || _.isNull(postID) || _.isNull(adAccountID))
            {
                return;
            }

            data = {
                format: 'json',
                magic: __g_sm,
                adAccountID: adAccountID,
                postID: postID,
                ownerID: ownerID,
                pageOwnerID: pageOwnerID
            };

            this.__serverCall(END_POINTS.GET_ADCREATIVEID, data, deferred);

            deferred.promise.then(this.getAdCreativeSuccess.bind(this)).fail(this.getAdCreativeFail.bind(this));
        };

        StepsWizard.prototype.getAdCreativeSuccess = function(_data)
        {
            this.adCreativeID = _data.creativeID;
            this.instagramActorID = _data.instagramActorID;
        };

        StepsWizard.prototype.getAdCreativeFail = function(failure)
        {
            this.adCreativeErrorMessage = failure.message;
            this.adCreativeID = null;
            this.instagramActorID = null;
        };


        /**
         * go to previous step
         * @returns {void}
         */
        StepsWizard.prototype.goPrevious = function()
        {
            if (this.canGoPrevious())
            {
                this.currentStep(this.stepsArr()[this.currentIndex() - 1]);
            }
        };

        /**
         * Routing function that calls the submitButtonFuncName
         */
        StepsWizard.prototype.submitFunc = function()
        {
            var realFunc,
                currentStepModel = this.currentStepModel();

            if (!_.isUndefined(currentStepModel[this.submitButtonFuncName()]) && _.isFunction(currentStepModel[this.submitButtonFuncName()]))
            {
                realFunc = this.submitButtonFuncName();
                currentStepModel[realFunc]();
            }
        };


        /**
         * Ajax util method
         * @param {String} url - url
         * @param {object} data - data json
         * @param {object} deferred - deferred object
         * @returns {void}
         * @private
         */
        StepsWizard.prototype.__serverCall = function(url, data, deferred)
        {
            $.tracxPostAndEval({
                url: url,
                data: data,
                errorHandler: function(error)
                {
                    //noinspection JSUnresolvedFunction
                    deferred.reject(error);
                },
                successHandler: function(response)
                {
                    //noinspection JSUnresolvedFunction
                    deferred.resolve(response.data);
                }
            });
        };

        /**
         * Searches for the step model that matches the name.
         * If it doesn't exist - returns null.
         * otherwise - returns the model.
         * @param {string} name
         * @returns Object|null
         */
        StepsWizard.prototype.getStepModelByName = function(name)
        {
            var modelToReturn = null; // in case the step isn't loaded yet, or invalid
            if (!_.isUndefined(name))
            {
                modelToReturn =  _.find(this.stepsModels(), function(model)
                {
                    if (model.title == name)
                    {
                        return model;
                    }
                });
            }
            return modelToReturn;
        };

        /**
         * todo: remove this function - wizard cant be dependent on sidebar
         * close the wizard
         * @return {void}
         */
        StepsWizard.prototype.close = function()
        {
            $.SrmSideBar.toggle('close', 'AdsSideBar');
        };

        /**
         * Cancel the wizard
         * return the wizard initial state
         * clean saved data & close the wizard
         * @return {void}
         */
        StepsWizard.prototype.cancel = function()
        {
            this.reset();
            this.accounts.removeAll();
            this.close();
        };

        /**
         *Reset method - clean all data & return to the first step
         *@returns {void}
         */
        StepsWizard.prototype.reset = function()
        {
            //clean all step from saved data
            _.each(this.stepsModels.peek(), function(stepModel)
            {
                stepModel.cleanStep.call(stepModel);
            });

            this.currentStep(this.stepsArr()[0]);
        };

        return StepsWizard;
    }
);
