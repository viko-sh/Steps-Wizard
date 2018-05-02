/**
 * Created by viktor on 6/14/2016.
 */
/*global __g_sm,Q, toggleGorila, ko, _, $, Modernizr, Tracx, require*/
define(
    [
        'resource!ko/components/boost/Wizard/StepBase',
        'resource!boost/wizard/InterestsManager',
        'resource!models/Audience',
        'resource!webStorage',
        'resource!ko/knockout-range',
        'resource!ko/knockout-validation',
        'resource!ko/knockout-utils',
        'resource!ko/knockout-remote-auto-complete',
        'resource!ko/validators/validate-decimal',
        'resource!ko/knockout-jstree'
    ],
    function(StepBase, InterestsManager, AudienceModel, WebStorage)
    {
        'use strict';

        var instance;

        /**
         * Constructor
         * @constructor
         * @returns {void}
         */
        function Audience()
        {
            this.title = 'Audience';

            this.AUDIENCE = {
                MIN_AGE: 13,
                MAX_AGE: 65
            };

            // location params
            this.countriesCollection = ko.observableArray([]).extend({'showOnSummary': false, hasChanges: false});
            this.citiesCollection = ko.observableArray([]).extend({'showOnSummary': false, hasChanges: false});
            this.statesCollection = ko.observableArray([]).extend({'showOnSummary': false, hasChanges: false});
            this.location = ko.pureComputed(this.__getAllLocations, this).extend({'showOnSummary': true, filterOnSummary: this.__filterAllLocations, doNotTrim: true });
            this.locationTypes = ko.observableArray([]).extend({'showOnSummary': false});
            this.locationType = ko.observable().extend({
                'showOnSummary': true, filterOnSummary: this.__filterSelectedLocation, doNotTrim: true, hasChanges: false});

            // age params
            this.maxAge = ko.observable(this.AUDIENCE.MAX_AGE).extend({rateLimit: 500, 'showOnSummary': false, hasChanges: false});
            this.minAge = ko.observable(this.AUDIENCE.MIN_AGE).extend({rateLimit: 500, 'showOnSummary': false, hasChanges: false});
            this.ages   = ko.pureComputed(this.__agesAsText, this).extend({'showOnSummary': true});

            // gender
            this.genderAll = null;
            this.females = ko.observable(true).extend({'showOnSummary': false, hasChanges: false});
            this.males = ko.observable(true).extend({'showOnSummary': false, hasChanges: false});

            //save audience
            this.isAudienceToSave = ko.observable(false).extend({'showOnSummary': false});
            this.audienceName = ko.observable().extend({'showOnSummary': false});

            //Audience name validation
            this.isAudienceNameValid = ko.pureComputed(this.__isAudienceNameValid, this).extend({'showOnSummary': false});
            this.shouldValidateAudienceName = ko.observable(false).extend({'showOnSummary': false});

            //location validation
            this.shouldValidateLocation = ko.observable(false).extend({'showOnSummary': false});
            this.isLocationsValid = ko.computed(this.__isLocationsValid, this).extend({'showOnSummary': false});

            //gender
            this.genderAll = ko.pureComputed({ read: this._allGenders_read, write: this._allGenders_write, owner: this }, this).extend({'showOnSummary': false});
            this.gender = ko.pureComputed(this.__genderAsText, this).extend({'showOnSummary': true, hasChanges: false,
                required: { params: true, message: 'Must make a selection'}});

            // language
            this.languagesCollection = ko.observableArray().extend({'showOnSummary': true, hasChanges: false, doNotTrim: true});

            // summary title
            this.titleSummary = ko.pureComputed(this.__titleSummary, this).extend({'showOnSummary': false});


            this.isAudienceToSave.subscribe(this.__isAudienceToSave.bind(this));

            // interests
            this.interestsTreeInstance = ko.observable().extend({'showOnSummary': false});
            this.interestsCollection = ko.observableArray([]).extend({'showOnSummary': false, hasChanges: false});
            this.interestsManager = new InterestsManager(this.interestsTreeInstance, this.interestsCollection);
            this.showInterests = ko.observable(false).extend({'showOnSummary': false});
            //show only the selected items
            this.interests = ko.pureComputed(this.__getInterests, this).extend({'showOnSummary': true, doNotTrim: true});

            //exclude interests
            this.excludedInterestsTreeInstance = ko.observable().extend({'showOnSummary': false});
            this.excludedInterestsCollection = ko.observableArray([]).extend({'showOnSummary': false, hasChanges: false});
            this.excludedInterestsManager = new InterestsManager(this.excludedInterestsTreeInstance, this.excludedInterestsCollection);
            this.showExcludedInterests = ko.observable(false).extend({'showOnSummary': false});
            this.excludedInterests = ko.pureComputed(this.__getExcludedInterests, this).extend({'showOnSummary': true, doNotTrim: true});

            this.__initSubscriptions();

            //load audience
            this.currentLoadedAudience      = ko.observable({}).extend({'showOnSummary': false});
            this.deletedAudienceID          = ko.observable(null).extend({'showOnSummary': false});

            //connections
            this.connectionsTypes = [
                {
                    id: '', text: 'None'
                },
                {
                    id: 'connections', text: 'People who like your page'
                },
                {
                    id: 'friends_of_connections', text: 'Friends of people who like your page'
                },
                {
                    id: 'excluded_connections', text: 'Exclude people who like your page'
                }
            ];
            this.connection = ko.observable().extend({'showOnSummary': true, filterOnSummary: this.__filterSelectedConnectionType.bind(this), doNotTrim: true });


            this.isAudienceLoaded = ko.computed(this.__isLoadedAudienceIsModified, this).extend({'showOnSummary': false});

            this.__jsTreeClickHandler();

        }//end of construct

        //inherit from StepBase
        Audience.augments(StepBase);

        /**
         * Handle click outside js tree menus
         * @return {void}
         * @private
         */
        Audience.prototype.__jsTreeClickHandler = function()
        {
            $(document).on('click', function(e)
            {
                if (!$('.interest-row-wrapper').has(e.target).length)
                {
                    try
                    {
                        this.interestsTreeInstance().close_all();
                        this.showInterests(false);
                        this.excludedInterestsTreeInstance().close_all();
                        this.showExcludedInterests(false);
                    }
                    catch (error)
                    {

                    }

                }
            }.bind(this));
        };

        Audience.prototype.__isAudienceToSave = function(_status)
        {
            var scrollTo,
                wizardBody;
            if (_status)
            {
                setTimeout(function()
                {
                    wizardBody = this.wizard.element.find('.wizard-body');
                    scrollTo = wizardBody[0].scrollHeight;
                    wizardBody.scrollTop(scrollTo);
                }.bind(this), 10);
            }
            else
            {
                //clean save audience field
                this.audienceName(undefined);
            }
        };

        /**
         * Show readable connection type on summary step
         * @return {string} - connection
         * @private
         */
        Audience.prototype.__filterSelectedConnectionType = function()
        {
            var selectedItem = this.connection(),
                selectedObject;
            if (!_.isUndefined(selectedItem))
            {
                selectedObject = _.where(this.connectionsTypes, {id: this.connection()});
                return selectedObject[0].text;
            }
        };

        /**
         * @private
         */
        Audience.prototype.__getInterests = function()
        {
            return _.filter(this.interestsCollection(), function(n)
            {
                return !n.is_parent;
            });
        };

        /**
         * @private
         */
        Audience.prototype.__getExcludedInterests = function()
        {
            return _.filter(this.excludedInterestsCollection(), function(n)
            {
                return !n.is_parent;
            });
        };


        /**
         * This method contains all the subscriptions for this model
         * @private
         * @returns {void}
         */
        Audience.prototype.__initSubscriptions = function()
        {
            //interest
            this.interestsCollection.subscribe(function(changes)
            {
                _.each(changes, function(change)
                {
                    //1.get the object from jstree
                    try
                    {
                        this.interestsTreeInstance().get_node(change.value.id);
                    }
                    catch (e)
                    {}

                    //send the data to interestManager
                    this.interestsManager[change.status].call(this.interestsManager, change.value);
                }.bind(this));
            }, this, 'arrayChange');

            //excluded interests
            this.excludedInterestsCollection.subscribe(function(changes)
            {
                _.each(changes, function(change)
                {
                    //1.get the object from jstree
                    try
                    {
                        this.excludedInterestsTreeInstance.get_node(change.value.id);
                    }
                    catch (e)
                    {}

                    //send the data to interestManager
                    this.excludedInterestsManager[change.status].call(this.excludedInterestsManager, change.value);
                }.bind(this));
            }, this, 'arrayChange');

        };

        /**
         * Track any change for loaded audience
         * this method will trigger
         * @returns {boolean}
         * @private
         */
        Audience.prototype.__isLoadedAudienceIsModified = function()
        {
            return this.countriesCollection.wasChanged() || this.citiesCollection.wasChanged() || this.statesCollection.wasChanged()
               || this.languagesCollection.wasChanged() || this.interestsCollection.wasChanged() || this.excludedInterestsCollection.wasChanged()
               || this.maxAge.wasChanged() || this.minAge.wasChanged() || this.gender.wasChanged();
        };


        Audience.prototype.__filterAllLocations = function()
        {
            var locations = this(),
                result = '';
            result = '<div>';

            _.each(locations, function(location)
            {
                if (locations[location].length)
                {
                    result += '<b>' + location + ':</b> ' + locations[location].join('; ') + '</br>';
                }
                else
                {
                    result += '<b>' + location + '</b> </br>';
                }
            });

            result += '</div>';
            return result;
        };


        Audience.prototype.__filterSelectedLocation = function()
        {
            var locationType = this();
            return locationType.type;
        };

        /**
         * This Method responsible for formatting selected locations
         * @private
         */
        Audience.prototype.__getAllLocations = function()
        {
            var countries = this.countriesCollection();
            var cities = this.citiesCollection();
            var states = this.statesCollection();
            var allLocations = countries.concat(cities).concat(states);
            var locations = [];
            var nameArr,
                locationName;

            _.each(allLocations, function(_location)
            {
                //handle country
                if (_location.type === 'country' && !_.has(locations, _location.name))
                {
                    locations.push(_location.name);
                    locations[_location.name] = [];
                }
                //city or state
                else
                {
                    if (!_.has(locations, _location.country_name))
                    {
                        locations.push(_location.country_name);
                        locations[_location.country_name] = [];
                    }
                    nameArr = _.map(_location.name.split(','), function(n)
                    {
                        return n.trim();
                    });
                    locationName = _.without(nameArr, _location.country_name);

                    locations[_location.country_name].push(locationName);
                }
            });

            return locations;
        };

        /**
         * Show / hide interests list on ui
         * @returns {void}
         */
        Audience.prototype.toggleInterests = function()
        {
            this.showInterests(!this.showInterests());
        };

        /**
         * Show / hide interests list on ui
         * @returns {void}
         */
        Audience.prototype.toggleExcludedInterests = function()
        {
            this.showExcludedInterests(!this.showExcludedInterests());
        };
        /**
         * Checking audience name value
         * @returns {boolean} - valid | not valid
         * @private
         */
        Audience.prototype.__isAudienceNameValid = function()
        {
            if (!this.shouldValidateAudienceName())
            {
                return true;
            }

            if (_.isUndefined(this.audienceName()))
            {
                return false;
            }

            if (_.isNull(this.audienceName()))
            {
                return false;
            }

            if ( this.audienceName().match(/^\s*$/g))
            {
                return false;
            }

            return true;

        };

        /**
         * Init this step, this method will be invoke from StepBase
         * @returns {void}
         */
        Audience.prototype.stepInit = function()
        {
            //set location types
            this.__setLocationTypes();
        };

        /**
         * Location Types are possible values for a user to choose from
         * This method is responsible to provide those options
         * 1. Get data from server or local storage
         * 2. Map data to objects
         * @private
         */
        Audience.prototype.__setLocationTypes = function()
        {
            var mappedData,
                deferred = Q.defer(),
                //use this object type later for mapping
                LocationType = function(type, id, value)
                {
                    this.type = type;
                    this.id = id;
                    this.value = value;
                },
                webStorage = new WebStorage(),
                localData,
                data  = {
                    format: 'json',
                    magic: __g_sm
                };
            webStorage.useSession();

            deferred.promise.then(
                function(_data)
                {
                    webStorage.setObjects('lt', _data);
                    //map data
                    mappedData =  _.map(_data, function(item)
                    {
                        return new LocationType(item.type, item.id, item.value);
                    });

                    //add new object to observableArray
                    this.locationTypes.push.apply(this.locationTypes, mappedData);
                }.bind(this));

            //try get the dat from local storage
            localData = webStorage.getObjects('lt');
            if (!_.isNull(localData) && localData.data.length > 0)
            {
                deferred.resolve(localData.data);
            }
            else
            {
                //server call
                this.wizard.__serverCall('/internal/PaidBoostApi/getLocationTypes', data, deferred);
            }

        };

        /**
         * Get ages computed value as text
         * @returns {string} - age
         * @private
         */
        Audience.prototype.__agesAsText = function()
        {
            var maxAgePlus = '',
                agesString = [];

            if ( _.isUndefined(this.minAge()))
            {
                agesString.push(this.AUDIENCE.MIN_AGE);
            }
            else
            {
                agesString.push(this.minAge());
            }

            if ( _.isUndefined(this.maxAge()))
            {
                agesString.push(this.AUDIENCE.MAX_AGE);
            }
            else
            {
                if ( this.maxAge() === this.AUDIENCE.MAX_AGE )
                {
                    maxAgePlus = '+';
                }
                agesString.push(this.maxAge() + maxAgePlus);
            }

            return agesString.join(' - ');
        };

        /**
         * Cancel audience saving process
         * @returns {void}
         */
        Audience.prototype.cancelAudienceSaving = function()
        {
            this.isAudienceToSave(false);
            this.shouldValidateAudienceName(false);
            this.audienceName(null);
        };

        /**
         * Show List of audiences
         * triggered on hover event
         * @returns {void}
         */
        Audience.prototype.showAudienceMenu = function()
        {
            $('.hover-menu').show();
        };

        /**
         * Hide the audiences list
         * @returns {void}
         */
        Audience.prototype.hideAudienceMenu = function()
        {
            if (!Tracx.notifications.isOpen())
            {
                $('.hover-menu').hide();
            }
        };


        /**
         * Save audience data to our server
         * @returns {void}
         */
        Audience.prototype.saveAudience = function()
        {

            var self = this,
                deferred = Q.defer(),
                data,
                audienceModel;

            this.shouldValidateLocation(true);

            if (!this.isLocationsValid())
            {
                return;
            }

            this.shouldValidateAudienceName(true);

            if (!this.isAudienceNameValid())
            {
                return;
            }

            //create new instance
            audienceModel = new AudienceModel({
                name: self.audienceName(),
                countries: self.countriesCollection(),
                cities: self.citiesCollection(),
                states: self.statesCollection(),
                interests: self.interestsCollection(),
                excludedInterests: self.excludedInterestsCollection(),
                languages: self.languagesCollection(),
                maxAge: self.maxAge(),
                minAge: self.minAge(),
                gender: self.gender()
            });

            data  = {
                format: 'json',
                magic: __g_sm,
                adAccountID: this.wizard.selectedAdAccount().adAccountID(),
                audienceData: audienceModel.toJson()
            };

            this.wizard.__serverCall('/internal/PaidBoostApi/createAudience', data, deferred);


            deferred.promise.then(
                function(_data)
                {
                    //show notification
                    Tracx.notifications.notify(Tracx.NotificationEnum.Type.SUCCESS, 'Audience was saved successfully', 'medium');
                    //reset audience form
                    self.audienceName(undefined);
                    self.isAudienceToSave(false);
                    self.shouldValidateAudienceName(false);
                    //add audienceID attribute to created audience
                    audienceModel.audienceID = _data;
                    //add audience to the collection
                    self.wizard.selectedAdAccount().audiences.push(audienceModel);
                    //clean current loaded audience
                    self.currentLoadedAudience({});
                });
        };

        /**
         * Load given audience data to the audience step
         * @returns {void}
         * @param {object} audienceModel - - clicked audience object
         */
        Audience.prototype.loadAudience = function(audienceModel)
        {
            var countries,
                cities,
                states,
                languages,
                genders,
                optionalGenders,
                difference,
                interests,
                excludedInterests,
                temp = [];

            //clean current data from fields
            this.__cleanFields();

            //load location
            countries           = _.isString(audienceModel.countries) ? ko.utils.parseJson(audienceModel.countries) : audienceModel.countries;
            cities              = _.isString(audienceModel.cities) ? ko.utils.parseJson(audienceModel.cities) : audienceModel.cities;
            states              = _.isString(audienceModel.states) ? ko.utils.parseJson(audienceModel.states) : audienceModel.states;
            interests           = _.isString(audienceModel.interests) ? ko.utils.parseJson(audienceModel.interests) : audienceModel.interests;
            excludedInterests   = _.isString(audienceModel.excludedInterests) ? ko.utils.parseJson(audienceModel.excludedInterests) : audienceModel.excludedInterests;

            if (!_.isEmpty(interests))
            {
                _.each(interests, function(_interest)
                {
                    temp.push(_interest);
                }, this);
                this.interestsCollection.pushAll(temp);
                temp = [];
            }

            if (!_.isEmpty(excludedInterests))
            {
                _.each(excludedInterests, function(_interest)
                {
                    temp.push(_interest);
                }, this);
                this.excludedInterestsCollection.pushAll(temp);
                temp = [];
            }

            if (!_.isEmpty(countries))
            {
                _.each(countries, function(_country)
                {
                    temp.push(_country);
                }, this);
                this.countriesCollection.pushAll(temp);
                temp = [];
            }

            if (!_.isEmpty(cities))
            {
                _.each(cities, function(_city)
                {
                    temp.push(_city);
                }, this);
                this.citiesCollection.pushAll(temp);
                temp = [];
            }

            if (!_.isEmpty(states))
            {
                _.each(states, function(_state)
                {
                    temp.push(_state);
                }, this);
                this.statesCollection.pushAll(temp);
                temp = [];
            }

            //load age
            this.minAge( !_.isNull(audienceModel.minAge) ? audienceModel.minAge : this.AUDIENCE.MIN_AGE);
            this.maxAge( !_.isNull(audienceModel.maxAge) ? audienceModel.maxAge : this.AUDIENCE.MAX_AGE);

            //load languages
            languages = _.isString(audienceModel.languages) ? ko.utils.parseJson(audienceModel.languages) : audienceModel.languages;
            if (!_.isEmpty(languages))
            {
                _.each(languages, function(_language)
                {
                    temp.push(_language);
                }, this);
                this.languagesCollection.pushAll(temp);
                temp = [];
            }

            //load gender
            optionalGenders = ['Males', 'Females'];
            if (!_.isEmpty(audienceModel.gender))
            {
                genders = audienceModel.gender.split(',').map(
                    function(n)
                    {
                        return n.trim();
                    });

                if (_.isArray(genders))
                {
                    _.each(genders, function(_gender)
                    {
                        if (_.has(this, _gender.toLowerCase()) && ko.isObservable(this[_gender.toLowerCase()]))
                        {
                            this[_gender.toLowerCase()](true);
                            this[_gender.toLowerCase()].resetChanges();
                        }
                    }, this);
                }

                difference = _.difference(optionalGenders, genders);
                if (_.isArray(difference))
                {
                    _.each(difference, function(_diff)
                    {
                        if (_.has(this, _diff.toLowerCase()) && ko.isObservable(this[_diff.toLowerCase()]))
                        {
                            this[_diff.toLowerCase()](false);
                            this[_diff.toLowerCase()].resetChanges();
                        }
                    }, this);
                }
            }

            this.interestsCollection.resetChanges();
            this.excludedInterestsCollection.resetChanges();
            this.citiesCollection.resetChanges();
            this.countriesCollection.resetChanges();
            this.statesCollection.resetChanges();
            this.minAge.resetChanges();
            this.languagesCollection.resetChanges();
            this.maxAge.resetChanges();
            this.gender.resetChanges();

            this.currentLoadedAudience(audienceModel);
        };

        /**
         * @param {object} audienceModel - clicked audience object
         * @param {event} event - event object
         * @returns {void}
         */
        Audience.prototype.deleteAudience = function(audienceModel)
        {
            Tracx.notifications.confirm('Are you sure you want to delete audience from list?', 'medium', this.__deleteAudience.bind(this, audienceModel), this.hideAudienceMenu);
        };

        /**
         * Delete audience from
         * @param {object} audienceModel - clicked audience object
         * @returns {void}
         * @private
         */
        Audience.prototype.__deleteAudience = function(audienceModel)
        {
            var deferred = Q.defer(),
                data;

            data = {
                format: 'json',
                magic: __g_sm,
                audienceID: audienceModel.audienceID,
                adAccountID: this.wizard.selectedAdAccount().adAccountID()
            };

            this.wizard.__serverCall('/internal/PaidBoostApi/deleteAudience', data, deferred);

            deferred.promise
                .then(function(_data)
                {
                    this.wizard.selectedAdAccount().audiences.remove(
                        function(item)
                        {
                            return +item.audienceID === +_data.audienceID;
                        });
                    this.hideAudienceMenu();

                    //if we deleting currently loaded audience, we should allow to re save it as a new one
                    this.deletedAudienceID(+_data.audienceID);

                }.bind(this));
        };


        /**
         * return a string of all the selected genders - to be displayed in the summary page
         * @private
         * @returns {String} - list of genders selected
         */
        Audience.prototype.__genderAsText = function()
        {
            var genderString = [];

            if ( this.females())
            {
                genderString.push('Females');
            }
            if ( this.males())
            {
                genderString.push('Males');
            }
            return genderString.join(', ');
        };

        /**
         * @returns {boolean} - if both genders are selected
         * @private
         */
        Audience.prototype._allGenders_read = function()
        {
            return (this.females() && this.males());
        };

        Audience.prototype._allGenders_write = function(value)
        {
            this.females(value);
            this.males(value);
        };

        /**
         * Return the model to the initial state
         * @returns {void}
         */
        Audience.prototype.cleanStep = function()
        {
            this.__cleanFields();
            this.currentLoadedAudience({});
            this.shouldValidateAudienceName(false);
            this.shouldValidateLocation(false);
            this.cancelAudienceSaving();
            this.showInterests(false);
            this.showExcludedInterests(false);
            this.locationType(this.locationTypes()[0]);
            this.locationType.resetChanges();
            this.connection(undefined);
        };

        /**
         * Clean
         * @returns {void}
         * @private
         */
        Audience.prototype.__cleanFields = function()
        {
            this.countriesCollection([]); this.countriesCollection.resetChanges();
            this.citiesCollection([]); this.citiesCollection.resetChanges();
            this.statesCollection([]); this.statesCollection.resetChanges();
            this.languagesCollection([]); this.languagesCollection.resetChanges();
            this.interestsCollection([]); this.interestsCollection.resetChanges();
            this.excludedInterestsCollection([]); this.excludedInterestsCollection.resetChanges();
            this.maxAge(this.AUDIENCE.MAX_AGE); this.maxAge.resetChanges();
            this.minAge(this.AUDIENCE.MIN_AGE); this.minAge.resetChanges();
            this.females(true); this.females.resetChanges();
            this.males(true); this.males.resetChanges();
            this.interestsManager.deleteAll();
            this.excludedInterestsManager.deleteAll();
        };

        Audience.prototype.locationHasFocus = function()
        {
            this.shouldValidateLocation(true);
        };

        /**
         * This method responsible for validating the countries and cities collections
         * @returns {boolean} - countries & cities collection empty or not
         */
        Audience.prototype.__isLocationsValid = function()
        {
            if (!this.shouldValidateLocation())
            {
                return true;
            }
            if (!this.countriesCollection().length && !this.citiesCollection().length && !this.statesCollection().length)
            {
                return false;
            }
            return true;
        };

        /**
         * return all the targeting data formatted ready for boost
         * @returns {Object} - all targeting data
         */
        Audience.prototype.getData = function()
        {
            var result = {};

            this.checkAndAdd(this, 'citiesCollection', result, 'targetCities');
            this.checkAndAdd(this, 'countriesCollection', result, 'targetCountries');
            this.checkAndAdd(this, 'statesCollection', result, 'targetStates');
            this.checkAndAdd(this, 'locationType', result, 'locationType');

            this.checkAndAdd(this, 'languagesCollection', result, 'targetLanguages');
            this.checkAndAdd(this, 'interests', result, 'targetInterests');
            this.checkAndAdd(this, 'excludedInterests', result, 'targetExcludedInterests');

            this.checkAndAdd(this, 'minAge', result, 'minAge');
            this.checkAndAdd(this, 'maxAge', result, 'maxAge');

            this.checkAndAdd(this, 'females', result, 'females');
            this.checkAndAdd(this, 'males', result, 'males');

            this.checkAndAdd(this, 'connection', result, 'connection');

            return result;
        };

        /**
         * Step Validation
         * @returns {boolean} - validation result
         */
        Audience.prototype.isStepValid = function()
        {
            var isValid = true;

            this.shouldValidateLocation(true);

            //check the if location section is valid
            if (!this.isLocationsValid())
            {
                isValid = false;
            }

            if (!this.gender.isValid())
            {
                isValid = false;
            }

            return isValid;
        };

        /**
         * Validate the step without showing any error messages
         * @returns {boolean}
         */
        Audience.prototype.silentValidation = function()
        {
            var isValid = true;

            if (!this.countriesCollection().length && !this.citiesCollection().length && !this.statesCollection().length)
            {
                isValid = false;
            }

            if (!this.gender.isValid())
            {
                isValid = false;
            }

            return isValid;
        };

        /**
         * Applying the single tone pattern
         * @type {Audience}
         */
        instance = new Audience();

        /**
         * Get current instance of Audience
         * the instance can be new || already initialized and stored in Wizard.stepsModels
         * @param {object} params - params from binding
         * @returns {object} - Audience
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
