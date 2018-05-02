/*global __g_sm, ko, _, _campaignID, Tracx, Q, require */


define(
    [
        'resource!ko/components/boost/Wizard/StepBase'
    ],
    function(StepBase)
    {
        'use strict';

        var instance;

        /**
         * Preview Class
         * @param {object} _data - preview parameters
         * @constructor
         * @return {void}
         */
        function Preview(_data)
        {
            this.id = _.has(_data, 'id') ? _data.id : null;
            this.iframe  = ko.observable(null);
            this.type = _.has(_data, 'type') ? _data.type : null;
            this.title = _.has(_data, 'title') ? _data.title : '';
            this.device = _.has(_data, 'device') ? _data.device : null;
        }

        /**
         * step constructor
         * @constructor
         */
        function Creative()
        {
            this.title = 'Creative';
            this.titleSummary = ko.pureComputed(this.__titleSummary, this).extend({'showOnSummary': false});

            this.selectedTabs = ko.observableArray().extend({'showOnSummary': false});
            this.tabsInstance = ko.observable().extend({'showOnSummary': false});
            this.tabsByContent = [];// eslint-disable-line

            this.previews = ko.mapping.fromJS([]).extend({'showOnSummary': false});
            this.activePreview = ko.observable().extend({'showOnSummary': false});
            this.availablePreviews = ko.observableArray().extend({'showOnSummary': false});
            this.setPreviews();


            this.canGoNext = ko.pureComputed(this.__canGoNext, this).extend({'showOnSummary': false});
            this.canGoPrev = ko.pureComputed(this.__canGoPrev, this).extend({'showOnSummary': false});// eslint-disable-line

            this.device = ko.observableArray().extend({'showOnSummary': true, filterOnSummary: this.__filterPlacement, doNotTrim: true });
            this.socialNetwork = ko.observableArray().extend({'showOnSummary': true, filterOnSummary: this.__filterPlacement, doNotTrim: true });
            this.facebookPositions = ko.observableArray().extend({'showOnSummary': true, filterOnSummary: this.__filterPlacement, doNotTrim: true });

            this.contentType = {};
            this.placements = ko.observableArray([]).extend({'showOnSummary': false});
            this.selectedPlacement = ko.observableArray([]).extend({'showOnSummary': false, required: { params: true, message: 'Select at least one placement'}});
            this.isDataLoaded = ko.observable(false).extend({'showOnSummary': false});
            this.__initSubscriptions();
        }

        Creative.augments(StepBase);

        /**
         * This method will run when class created for the first time
         * @override stepBase
         * @return {void}
         */
        Creative.prototype.stepInit = function()
        {
            this.__getPostedContentDetails();
        };


        Creative.prototype.setPreviews = function()
        {
            var _previews = [
                {id: 'mobile', type: 'MOBILE_FEED_STANDARD', title: 'Mobile Preview', device: 'mobile' },
                {id: 'desktop', type: 'DESKTOP_FEED_STANDARD', title: 'Desktop Preview', device: 'desktop'},
                {id: 'rightColumn', type: 'RIGHT_COLUMN_STANDARD', title: 'Right Column Preview', device: 'desktop'},
                {id: 'instagram', type: 'INSTAGRAM_STANDARD', title: 'Instagram Preview', device: 'mobile'}
            ];

            ko.mapping.fromJS(_previews, {
                create: function(options)
                {
                    return new Preview(options.data);
                }
            }, this.previews);
        };

        /**
         * init model subscriptions
         * @private
         * @returns {void}
         */
        Creative.prototype.__initSubscriptions = function()
        {
            this.selectedPlacement.subscribe(function(changes)
            {
                _.each(changes, function(change)
                {
                    if (change.status === 'added')
                    {
                        this._addPreview(change.value);
                    }
                    else
                    {
                        this._removePreview(change.value);
                    }
                }.bind(this));
                this.__updateSpecs();
            }, this, 'arrayChange');


            this.activePreview.subscribe(function(preview)
            {
                if (_.isNull(preview))
                {
                    return;
                }

                if (_.isEmpty(preview.iframe()))
                {
                    this.getAdPreview(preview);
                }
            }, this);
        };

        /**
         * Add preview object to available previews
         * @param {object} placement - placement object
         * @return {void}
         * @private
         */
        Creative.prototype._addPreview = function(placement)
        {
            var temp;

            _.each(placement.preview, function(preview)
            {

                temp = _.find(this.previews(), function(_item)
                {
                    return _item.id === preview;
                });

                //check if the item doesn't already in the collection
                if (_.indexOf(this.availablePreviews(), temp) === -1)
                {
                    this.availablePreviews.push(temp);
                }

                if (_.isEmpty(this.activePreview()))
                {
                    this.activePreview(temp);
                }

                this._updateActivePreview();
            }.bind(this));
        };

        /**
         * Remove preview object from available previews
         * @param {object} placement - placement object
         * @return {void}
         * @private
         */
        Creative.prototype._removePreview = function(placement)
        {
            var temp;
            _.each(placement.preview, function(preview)
            {
                temp = _.find(this.previews(), function(_item)
                {
                    return _item.id === preview;
                });

                this.availablePreviews.remove(temp);

                this._updateActivePreview();

            }.bind(this));
        };

        /**
         * Update current preview according to placement selection changes
         * @private
         * @return {void}
         */
        Creative.prototype._updateActivePreview = function()
        {
            var previews = this.availablePreviews(),
                currentPreview = this.activePreview();

            //if all placement were unchecked, set active to null
            if ( !previews.length )
            {
                this.activePreview(null);
            }

            //check if removed item was the active one
            if (_.indexOf(previews, currentPreview) === -1)
            {
                if (!previews.length)
                {
                    //if the last option was removed
                    this.activePreview(null);
                }
                else
                {
                    //set the first option as current
                    this.activePreview(this.availablePreviews()[0]);
                }
            }
        };

        /**
         * Get post type
         * @private
         * @return {void}
         */
        Creative.prototype.__getPostedContentDetails = function()
        {
            var deferred = Q.defer(),
                data,
                postID = this.wizard.selectedPostID,
                adAccountID = (ko.isObservable(this.wizard.selectedAdAccount) && !_.isEmpty(this.wizard.selectedAdAccount()) ) ? this.wizard.selectedAdAccount().adAccountID() : null,
                ownerID = this.wizard.getOwnerID(adAccountID);

            data = {
                format: 'json',
                magic: __g_sm,
                postID: postID,
                ownerID: ownerID
            };

            this.wizard.__serverCall('/internal/PaidBoostApi/getPostedData', data, deferred);

            deferred.promise.then(this.__setMediaType.bind(this));
            deferred.promise.fail(this.fetchPreviewFailure.bind(this));
        };

        /**
         * Init tabs component
         * @private
         * @returns {void}
         */
        Creative.prototype.__setMediaType = function(_data)
        {
            var modelName = _data.jsType;

            require(['resource!ko/components/boost/dashboard/' + modelName], function(MediaType) //eslint-disable-line global-require
            {
                this.contentType = new MediaType(_data);
                this.tabsInstance().setData(this.contentType._TABS);
                this.isDataLoaded(true);
            }.bind(this));
        };

        /**
         * Filter data on summary
         * @returns {string|*} - filtered string
         * @private
         */
        Creative.prototype.__filterPlacement = function()
        {
            var placement = this();
            if (!_.isEmpty(placement))
            {
                placement = _.map(placement, function(_txt)
                {
                    return _txt.replace(/_/g, ' ');
                });
            }
            return placement.join(', ');
        };


        /**
         * Triggered from Tabs component when tabs state changed
         * @param {array} selectedTab - current selected tab
         * @returns {void}
         */
        Creative.prototype.onSelectedTabs = function(selectedTab)
        {
            var placementOptions = [],
                temp;
            if (_.isUndefined(selectedTab))
            {
                return;
            }

            _.each(selectedTab.placements, function(_id)
            {
                temp = _.find(this.contentType.PLACEMENTS,
                    function(placement)
                    {
                        if (placement.id === _id)
                        {
                            return placement;
                        }
                    });

                if (!_.isNull(temp))
                {
                    placementOptions.push(temp);
                }
            }.bind(this));

            this.placements.removeAll();
            this.placements.pushAll(placementOptions);
            this.selectedPlacement.removeAll();
            this.selectedPlacement.pushAll(placementOptions);
        };


        /**
         * This method responsible for updating placement specs
         * according to the selected tabs
         * @returns {void}
         * @private
         */
        Creative.prototype.__updateSpecs = function()
        {
            var device = [],
                socialNetwork = [],
                facebookPositions = [],
                selectedTab = this.tabsInstance().getSelectedTabs().shift();

            //reset all the specs
            this.device([]);
            this.socialNetwork([]);
            this.facebookPositions([]);

            this.device(selectedTab.device_platforms);

            //get selected tabs
            _.each(this.selectedPlacement(), function(placement)
            {
                if (!_.isUndefined(placement.facebook_positions))
                {
                    facebookPositions.push(placement.facebook_positions);
                }

                if (!_.isUndefined(placement.publisher_platforms))
                {
                    socialNetwork.push(placement.publisher_platforms);
                }
            });

            this.socialNetwork(_.uniq(socialNetwork));
            this.facebookPositions(_.uniq(facebookPositions));
        };

        /**
         * Next button state according to current tab
         * @returns {boolean} - state
         * @private
         */
        Creative.prototype.__canGoNext = function()
        {
            var previews = this.availablePreviews(),
                currentPreview = this.activePreview(),
                pos;

            if (!previews.length)
            {
                return false;
            }

            pos = _.indexOf(previews, currentPreview);

            return pos !== -1 && (pos < previews.length - 1);

        };

        /**
         * Prev button state according to current tab
         * @returns {boolean} - state
         * @private
         */
        Creative.prototype.__canGoPrev = function()
        {
            var previews = this.availablePreviews(),
                currentPreview = this.activePreview();

            if (!previews.length)
            {
                return false;
            }

            return _.indexOf(previews, currentPreview) !== 0;
        };

        /**
         * Get Preview for current tab
         * @param {object} _activeTab - current Tab object
         * @returns {void}
         */
        Creative.prototype.getAdPreview = function(placement)
        {
            var deferred = Q.defer(),
                ownerID,
                adAccountID,
                creativeID,
                iframeElement,
                data;

            //get the must params for this request
            adAccountID = (ko.isObservable(this.wizard.selectedAdAccount) && !_.isEmpty(this.wizard.selectedAdAccount()) ) ? this.wizard.selectedAdAccount().adAccountID() : null;
            ownerID = this.wizard.getOwnerID(adAccountID);
            creativeID = this.wizard.adCreativeID;

            //we can't get preview without creativeID
            if (_.isNull(creativeID) ||  _.isNull(ownerID))
            {
                return;
            }

            data = {
                format: 'json',
                magic: __g_sm,
                creativeID: creativeID,
                type: placement.type,
                ownerID: ownerID
            };

            this.wizard.__serverCall('/internal/PaidBoostApi/getPreview', data, deferred);

            deferred.promise.then(function(_data)
            {
                //create a virtual dom object and use jquery to access properties
                iframeElement = $(_data.iframe)[0];
                //add the iframe element to tab object for lazy load
                placement.iframe(iframeElement.src);

            });

            deferred.promise.fail(this.fetchPreviewFailure.bind(this));
        };

        /**
         * Preview failure callback
         * @param {object} failure - failure object
         * @returns {void}
         */
        Creative.prototype.fetchPreviewFailure = function(failure)
        {
            var severity = Tracx.NotificationEnum.Type.ERROR;
            Tracx.notifications.notify(severity, failure.message, 'medium');
        };

        /**
         * Next Tab
         * Triggered from Creative view
         * @returns {void}
         */
        Creative.prototype.nextTab = function()
        {
            //get current tab position in selected tabs collection
            var previews = this.availablePreviews(),
                currentPreview = this.activePreview(),
                pos,
                next;

            pos = _.indexOf(previews, currentPreview);
            //set new current tab
            if (pos !== -1 && (pos < previews.length - 1))
            {
                next = previews[pos + 1];
                this.activePreview(next);
            }
        };

        /**
         * Prev Tab
         * Triggered from Creative view
         * @returns {void}
         */
        Creative.prototype.prevTab = function()
        {
            //get current tab position in selected tabs collection
            var previews = this.availablePreviews(),
                currentPreview = this.activePreview(),
                pos,
                prev;

            //set new current tab
            pos = _.indexOf(previews, currentPreview);
            if (pos !== 0)
            {
                prev = previews[pos - 1];
                this.activePreview(prev);
            }
        };


        /**
         * Return the model to the initial state
         * @return {void}
         */
        Creative.prototype.cleanStep = function()
        {
            this.selectedPlacement.removeAll();
            this.placements.removeAll();
            this.device([]);
            this.socialNetwork([]);
            this.facebookPositions([]);
            this.tabsInstance().reset(this.contentType._TABS);
            this.contentType = {};
            this.availablePreviews.removeAll();
            _.each(this.previews(), function(preview)
            {
                preview.iframe(null);
            });
            this.isDataLoaded(false);
        };


        /**
         * This method will run every time step is entered
         * @override stepBase
         * @return {void}
         */
        Creative.prototype.stepEnter = function()
        {
            if (_.isEmpty(this.contentType))
            {
                this.__getPostedContentDetails();
            }
        };

        /**
         * Step Validation
         * @returns {boolean} - validation result
         */
        Creative.prototype.isStepValid = function()
        {
            return this.selectedPlacement.isValid();
        };

        /**
         * Silent Validation
         * @return {boolean} - get step validation step
         */
        Creative.prototype.silentValidation = function()
        {
            return this.isStepValid();
        };

        /**
         * Get step data
         * @return {object} - step data
         */
        Creative.prototype.getData = function()
        {
            var result = {};

            this.checkAndAdd(this, 'device', result, 'device_platforms');
            this.checkAndAdd(this, 'socialNetwork', result, 'publisher_platforms');
            this.checkAndAdd(this, 'facebookPositions', result, 'facebook_positions');
            return result;
        };

        instance = new Creative();

        /**
         * return a new instance or the existing instance
         * @param {object} params -
         * @returns {Creative|object} -
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
