/* global Module */

/* Magic Mirror
 * Module: Calendar
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("my-calendar", {

    // Define module defaults
    defaults: {
        maximumEntries: 10, // Total Maximum Entries
        maximumNumberOfDays: 365,
        displaySymbol: true,
        defaultSymbol: "calendar", // Fontawesome Symbol see http://fontawesome.io/cheatsheet/
        displayRepeatingCountTitle: false,
        defaultRepeatingCountTitle: "",
        maxTitleLength: 25,
        wrapEvents: false, // wrap events to multiple lines breaking at maxTitleLength
        fetchInterval: 5 * 60 * 1000, // Update every 5 minutes.
        animationSpeed: 2000,
        fade: true,
        urgency: 7,
        timeFormat: "relative",
        dateFormat: "MMM Do",
        fullDayEventDateFormat: "MMM Do",
        getRelative: 6,
        fadePoint: 0.25, // Start on 1/4th of the list.
        hidePrivate: false,
        colored: false,
        calendars: [
            {
                symbol: "calendar",
                url: "http://www.calendarlabs.com/templates/ical/US-Holidays.ics",
            },
        ],
        titleReplace: {
            "De verjaardag van ": "",
            "'s birthday": ""
        },
        broadcastEvents: true,
        excludedEvents: []
    },

    // Define required scripts.
    getStyles: function () {
        return ["my-calendar.css", "font-awesome.css"];
    },

    // Define required scripts.
    getScripts: function () {
        return ["moment.js"];
    },

    // Define required translations.
    getTranslations: function () {
        // The translations for the default modules are defined in the core translation files.
        // Therefor we can just return false. Otherwise we should have returned a dictionary.
        // If you're trying to build your own module including translations, check out the documentation.
        return false;
    },

    // Override start method.
    start: function () {
        Log.log("Starting module: " + this.name);

        // Set locale.
        moment.updateLocale(config.language, this.getLocaleSpecification(config.timeFormat));

        for (var c in this.config.calendars) {
            var calendar = this.config.calendars[c];
            calendar.url = calendar.url.replace("webcal://", "http://");

            var calendarConfig = {
                maximumEntries: calendar.maximumEntries,
                maximumNumberOfDays: calendar.maximumNumberOfDays
            };

            // we check user and password here for backwards compatibility with old configs
            if (calendar.user && calendar.pass) {
                Log.warn("Deprecation warning: Please update your calendar authentication configuration.");
                Log.warn("https://github.com/MichMich/MagicMirror/tree/v2.1.2/modules/default/calendar#calendar-authentication-options");
                calendar.auth = {
                    user: calendar.user,
                    pass: calendar.pass
                }
            }

            this.addCalendar(calendar.url, calendar.auth, calendarConfig);
        }

        this.calendarData = {};
        this.loaded = false;
    },

    // Override socket notification handler.
    socketNotificationReceived: function (notification, payload) {
        if (notification === "CALENDAR_EVENTS") {
            if (this.hasCalendarURL(payload.url)) {
                this.calendarData[payload.url] = payload.events;
                this.loaded = true;

                if (this.config.broadcastEvents) {
                    this.broadcastEvents();
                }
            }
        } else if (notification === "FETCH_ERROR") {
            Log.error("Calendar Error. Could not fetch calendar: " + payload.url);
        } else if (notification === "INCORRECT_URL") {
            Log.error("Calendar Error. Incorrect url: " + payload.url);
        } else {
            Log.log("Calendar received an unknown socket notification: " + notification);
        }

        this.updateDom(this.config.animationSpeed);
    },

    // Override dom generator.
    getDom: function () {

        let events = this.createEventList();
        let wrapper = document.createElement("table");
        wrapper.className = "small";

        if (events.length === 0) {
            wrapper.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
            wrapper.className = "small dimmed";
            return wrapper;
        }

        wrapper.appendChild(this.createTableHeaders());

        let mondayEvents = [];
        let tuesdayEvents = [];
        let wednesdayEvents = [];
        let thursdayEvents = [];
        let fridayEvents = [];
        let saturdayEvents = [];
        let sundayEvents = [];

        let weekdays = [
            mondayEvents,
            tuesdayEvents,
            wednesdayEvents,
            thursdayEvents,
            fridayEvents,
            saturdayEvents,
            sundayEvents
        ];

        for (let e in events) {
            let event = events[e];
            Log.log(event);
            let eventStartDate = moment(parseInt(event.startDate));
            Log.info('Diff:' + eventStartDate.diff(moment(), 'days', false));

            // Leave if today is monday and the event is next week monday
            if (eventStartDate.diff(moment(), 'days', false) >= 7) break;

            Log.log(moment(parseInt(event.startDate)).day());
            let dayOfWeek = moment(parseInt(event.startDate)).day();

            if (dayOfWeek === 1) {
                mondayEvents.push(event);
            } else if (dayOfWeek === 2) {
                tuesdayEvents.push(event);
            } else if (dayOfWeek === 3) {
                wednesdayEvents.push(event);
            } else if (dayOfWeek === 4) {
                thursdayEvents.push(event);
            } else if (dayOfWeek === 5) {
                fridayEvents.push(event);
            } else if (dayOfWeek === 6) {
                saturdayEvents.push(event);
            } else if (dayOfWeek === 7) {
                sundayEvents.push(event);
            }
        }

        Log.info(weekdays);

        let maxEventCount = 0;

        weekdays.forEach(function (eventForWeekday) {
            if(eventForWeekday.length > maxEventCount)
                maxEventCount = eventForWeekday.length;
        });

        for (i = 0; i < maxEventCount; i ++) {
            let eventWrapper = document.createElement("tr");

            if (this.config.colored) {
                eventWrapper.style.cssText = "color:" + this.colorForUrl(event.url);
            }

            eventWrapper.className = "normal";

            eventWrapper.appendChild(this.displayEvent(mondayEvents[i]));
            eventWrapper.appendChild(this.displayEvent(tuesdayEvents[i]));
            eventWrapper.appendChild(this.displayEvent(wednesdayEvents[i]));
            eventWrapper.appendChild(this.displayEvent(thursdayEvents[i]));
            eventWrapper.appendChild(this.displayEvent(fridayEvents[i]));
            eventWrapper.appendChild(this.displayEvent(saturdayEvents[i]));
            eventWrapper.appendChild(this.displayEvent(sundayEvents[i]));

            wrapper.appendChild(eventWrapper);
        }


        return wrapper;
    },

    createTableHeaders: function () {
        let headersRow = document.createElement("tr");
        headersRow.className = 'normal';

        let monday = document.createElement("th");
        monday.innerHTML = "Montag";
        monday.className = "title";

        let tuesday = document.createElement("th");
        tuesday.innerHTML = "Dienstag";
        tuesday.className = "title";

        let wednesday = document.createElement("th");
        wednesday.innerHTML = "Mittwoch";
        wednesday.className = "title";

        let thursday = document.createElement("th");
        thursday.innerHTML = "Donnerstag";
        thursday.className = "title";

        let friday = document.createElement("th");
        friday.innerHTML = "Freitag";
        friday.className = "title";

        let saturday = document.createElement("th");
        saturday.innerHTML = "Samstag";
        saturday.className = "title";

        let sunday = document.createElement("th");
        sunday.innerHTML = "Sonntag";
        sunday.className = "title";

        headersRow.appendChild(monday);
        headersRow.appendChild(tuesday);
        headersRow.appendChild(wednesday);
        headersRow.appendChild(thursday);
        headersRow.appendChild(friday);
        headersRow.appendChild(saturday);
        headersRow.appendChild(sunday);

        return headersRow;
    },

    displayEvent: function (event) {
        let titleWrapper = document.createElement("td"), repeatingCountTitle = "";
        if(!event)
            return titleWrapper;

        if(!event.fullDayEvent) {
            let startDate = moment(parseInt(event.startDate)).format('HH:mm');
            titleWrapper.innerHTML =  startDate + ' ' + this.titleTransform(event.title) + repeatingCountTitle;

        } else {
            titleWrapper.innerHTML = this.titleTransform(event.title) + repeatingCountTitle;
        }

        if (!this.config.colored) {
            titleWrapper.className = "title bright";
        } else {
            titleWrapper.className = "title";
        }

        return titleWrapper;
    },

    /**
     * This function accepts a number (either 12 or 24) and returns a moment.js LocaleSpecification with the
     * corresponding timeformat to be used in the calendar display. If no number is given (or otherwise invalid input)
     * it will a localeSpecification object with the system locale time format.
     *
     * @param {number} timeFormat Specifies either 12 or 24 hour time format
     * @returns {{longDateFormat: {LT: string}}}
     */
    getLocaleSpecification: function (timeFormat) {
        switch (timeFormat) {
            case 12: {
                return {longDateFormat: {LT: "h:mm A"}};
                break;
            }
            case 24: {
                return {longDateFormat: {LT: "HH:mm"}};
                break;
            }
            default: {
                return {longDateFormat: {LT: moment.localeData().longDateFormat("LT")}};
                break;
            }
        }
    },

    /* hasCalendarURL(url)
     * Check if this config contains the calendar url.
     *
     * argument url string - Url to look for.
     *
     * return bool - Has calendar url
     */
    hasCalendarURL: function (url) {
        for (let c in this.config.calendars) {
            let calendar = this.config.calendars[c];
            if (calendar.url === url) {
                return true;
            }
        }

        return false;
    },

    /* createEventList()
     * Creates the sorted list of all events.
     *
     * return array - Array with events.
     */
    createEventList: function () {
        let events = [];
        let today = moment().startOf("day");
        for (let c in this.calendarData) {
            let calendar = this.calendarData[c];
            for (let e in calendar) {
                let event = calendar[e];
                if (this.config.hidePrivate) {
                    if (event.class === "PRIVATE") {
                        // do not add the current event, skip it
                        continue;
                    }
                }
                event.url = c;
                event.today = event.startDate >= today && event.startDate < (today + 24 * 60 * 60 * 1000);
                events.push(event);
            }
        }

        events.sort(function (a, b) {
            return a.startDate - b.startDate;
        });

        return events;
    },

    /* createEventList(url)
     * Requests node helper to add calendar url.
     *
     * argument url string - Url to add.
     */
    addCalendar: function (url, auth, calendarConfig) {
        this.sendSocketNotification("ADD_CALENDAR", {
            url: url,
            excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
            maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
            maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
            fetchInterval: this.config.fetchInterval,
            auth: auth
        });
    },

    /* symbolsForUrl(url)
     * Retrieves the symbols for a specific url.
     *
     * argument url string - Url to look for.
     *
     * return string/array - The Symbols
     */
    symbolsForUrl: function (url) {
        return this.getCalendarProperty(url, "symbol", this.config.defaultSymbol);
    },

    /* colorForUrl(url)
     * Retrieves the color for a specific url.
     *
     * argument url string - Url to look for.
     *
     * return string - The Color
     */
    colorForUrl: function (url) {
        return this.getCalendarProperty(url, "color", "#fff");
    },

    /* countTitleForUrl(url)
     * Retrieves the name for a specific url.
     *
     * argument url string - Url to look for.
     *
     * return string - The Symbol
     */
    countTitleForUrl: function (url) {
        return this.getCalendarProperty(url, "repeatingCountTitle", this.config.defaultRepeatingCountTitle);
    },

    /* getCalendarProperty(url, property, defaultValue)
     * Helper method to retrieve the property for a specific url.
     *
     * argument url string - Url to look for.
     * argument property string - Property to look for.
     * argument defaultValue string - Value if property is not found.
     *
     * return string - The Property
     */
    getCalendarProperty: function (url, property, defaultValue) {
        for (let c in this.config.calendars) {
            let calendar = this.config.calendars[c];
            if (calendar.url === url && calendar.hasOwnProperty(property)) {
                return calendar[property];
            }
        }

        return defaultValue;
    },

    /**
     * Shortens a string if it's longer than maxLength and add a ellipsis to the end
     *
     * @param {string} string Text string to shorten
     * @param {number} maxLength The max length of the string
     * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
     * @returns {string} The shortened string
     */
    shorten: function (string, maxLength, wrapEvents) {
        if (typeof string !== "string") {
            return "";
        }

        if (wrapEvents === true) {
            let temp = "";
            let currentLine = "";
            let words = string.split(" ");

            for (let i = 0; i < words.length; i++) {
                let word = words[i];
                if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) { // max - 1 to account for a space
                    currentLine += (word + " ");
                } else {
                    if (currentLine.length > 0) {
                        temp += (currentLine + "<br>" + word + " ");
                    } else {
                        temp += (word + "<br>");
                    }
                    currentLine = "";
                }
            }

            return (temp + currentLine).trim();
        } else {
            if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
                return string.trim().slice(0, maxLength) + "&hellip;";
            } else {
                return string.trim();
            }
        }
    },

    /* capFirst(string)
     * Capitalize the first letter of a string
     * Return capitalized string
     */

    capFirst: function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    /* titleTransform(title)
     * Transforms the title of an event for usage.
     * Replaces parts of the text as defined in config.titleReplace.
     * Shortens title based on config.maxTitleLength and config.wrapEvents
     *
     * argument title string - The title to transform.
     *
     * return string - The transformed title.
     */
    titleTransform: function (title) {
        for (let needle in this.config.titleReplace) {
            let replacement = this.config.titleReplace[needle];

            let regParts = needle.match(/^\/(.+)\/([gim]*)$/);
            if (regParts) {
                // the parsed pattern is a regexp.
                needle = new RegExp(regParts[1], regParts[2]);
            }

            title = title.replace(needle, replacement);
        }

        title = this.shorten(title, this.config.maxTitleLength, this.config.wrapEvents);
        return title;
    },

    /* broadcastEvents()
     * Broadcasts the events to all other modules for reuse.
     * The all events available in one array, sorted on startdate.
     */
    broadcastEvents: function () {
        let eventList = [];
        for (let url in this.calendarData) {
            let calendar = this.calendarData[url];
            for (let e in calendar) {
                let event = cloneObject(calendar[e]);
                event.symbol = this.symbolsForUrl(url);
                event.color = this.colorForUrl(url);
                delete event.url;
                eventList.push(event);
            }
        }

        eventList.sort(function (a, b) {
            return a.startDate - b.startDate;
        });

        this.sendNotification("CALENDAR_EVENTS", eventList);

    }
});
