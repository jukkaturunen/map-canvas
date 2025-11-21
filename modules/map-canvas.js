import {MAP_STYLES} from "./map-canvas-styles.js";
import {ImageDataConverter} from "./image-data-converter.js";

class MapDialog extends FormApplication {

    constructor(object, options) {
        super(object, options);

        // Using window['mapcanvas'] as a way to track dialog state. Not ideal.
        window['mapcanvas'].dialogActive = true;
        window['mapcanvas'].apiLoaded = false;

        // Initialization of Google Maps is now ensured in activateListeners to guarantee DOM exists in v13
        // while still keeping backward compatibility with earlier versions.

        Hooks.on('mapCanvasToggleLabels', this.toggleLabels);
        MapDialog.labelsOn = true;
    }

    static get defaultOptions() {
        let opts = super.defaultOptions;
        opts.id = "mapCanvasDialog";
        opts.base = "mc_";
        opts.title = "Map Canvas";
        opts.template = "modules/map-canvas/templates/map-canvas.html";
        opts.resizable = true;
        opts.isEditable = false;
        opts.closeOnSubmit = false;
        opts.popOut = true;
        return opts;
    }

    static getMapStyle() {
        let styleJSON = [];
        const mapCanvasStyle = game.settings.get("map-canvas", "DEFAULT_MAP_STYLE");

        if(mapCanvasStyle.toUpperCase() === "CUSTOM" ) { // If they're using custom we have to parse the string to JSON.
            styleJSON = JSON.parse(game.settings.get("map-canvas", "CUSTOM_MAP_STYLE_JSON"));
        } else {
            styleJSON = MAP_STYLES[mapCanvasStyle.toUpperCase()];
        }

        return styleJSON;
    }


    // 40.7571, -73.8458 - Citi Field, Queens, NY - LET'S GO METS!
    static initMap(center = { lat: 40.7571, lng: -73.8458 }) {
        
        const lastUsedLat = game.settings.get('map-canvas', 'LAST_USED_LAT');
        const lastUsedLng = game.settings.get('map-canvas', 'LAST_USED_LNG');
        if(lastUsedLat && lastUsedLng){
            center = { lat: lastUsedLat, lng: lastUsedLng };
        }


        MapDialog.mapPortal = {};
        MapDialog.placesService = {};
        MapDialog.mapPortalElem = document.querySelector('#mapPortal');
        MapDialog.searchBoxElem = document.querySelector('#mapCanvasSearchBox');
        MapDialog.zoomLevelElem = document.querySelector('#mapCanvasZoomLevel');

        const opts = {
            center: center,
            zoom: 17,
            tilt: 0, // Suppress tilting on zoom in by default. (users can still toggle it on)
            scaleControl: true,
            disableDefaultUI: false,
            streetViewControl: false, // TODO: Figure out how to make Street View capture properly.
            mapTypeId: google.maps.MapTypeId[game.settings.get("map-canvas", "DEFAULT_MAP_MODE")],
           // mapTypeId: google.maps.MapTypeId.SATELLITE,
            styles: this.getMapStyle()
        }

        MapDialog.mapPortal = new google.maps.Map(MapDialog.mapPortalElem, opts);

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', (e) => {
            MapDialog.zoomLevelElem.value = MapDialog.mapPortal.getZoom();
        });
        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', (e) => {
            MapDialog.zoomLevelElem.value = MapDialog.mapPortal.getZoom();
        });
    
        // Set the last used zoom level and scene name
        const lastUsedZoom = game.settings.get("map-canvas", "LAST_USED_ZOOM");
        if (lastUsedZoom) {
            MapDialog.mapPortal.setZoom(lastUsedZoom);
            MapDialog.zoomLevelElem.value = lastUsedZoom;
        }
    
        const sceneNameElement = document.querySelector('#mapCanvasSceneName');
        const lastUsedSceneName = game.settings.get("map-canvas", "LAST_USED_SCENE_NAME");
        if (lastUsedSceneName) {
            
            if (sceneNameElement) {
                sceneNameElement.value = lastUsedSceneName;
            }
        }

        MapDialog.searchBoxElem.addEventListener('input', (event) => {
            // For demonstration, directly using the search input value
            // You can replace this with more complex logic as needed
            sceneNameElement.value = event.target.value;
        });

        MapDialog.placesService = new google.maps.places.PlacesService(MapDialog.mapPortal);

        MapDialog.initAutocomplete(MapDialog.mapPortal, MapDialog.searchBoxElem);

        google.maps.event.addListener(MapDialog.mapPortal, 'center_changed', () => {
            const newCenter = MapDialog.mapPortal.getCenter();
            game.settings.set('map-canvas', 'LAST_USED_LAT', newCenter.lat());
            game.settings.set('map-canvas', 'LAST_USED_LNG', newCenter.lng());
        });

        google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', () => {
            const newZoom = MapDialog.mapPortal.getZoom();
            game.settings.set('map-canvas', 'LAST_USED_ZOOM', newZoom);
        });
        google.maps.event.addListenerOnce(MapDialog.mapPortal, 'idle', () => {
            const bounds = MapDialog.mapPortal.getBounds();
            const ne = bounds.getNorthEast(); // North East corner
            const sw = bounds.getSouthWest(); // South West corner

            //google.maps.event.addListenerOnce(MapDialog.mapPortal, 'idle', MapDialog.calculateZoneSize);
            //google.maps.event.addListener(MapDialog.mapPortal, 'zoom_changed', MapDialog.calculateZoneSize);
    
        });

    }

    // Adapted from: https://developers.google.com/maps/documentation/javascript/examples/places-searchbox
    static initAutocomplete(map, input) {
        const searchBox = new google.maps.places.SearchBox(input);

        map.addListener("bounds_changed", () => {
            searchBox.setBounds(map.getBounds());
        });

        // Listen for the event fired when the user selects a prediction and retrieve
        // more details for that place.
        searchBox.addListener("places_changed", () => {
            const places = searchBox.getPlaces();

            if (places.length === 0) {
                return;
            }
            if (places.length > 0 && places[0].geometry && places[0].geometry.location) {
                // Save the new location
                const newCenter = places[0].geometry.location;
                game.settings.set('map-canvas', 'LAST_USED_LAT', newCenter.lat());
                game.settings.set('map-canvas', 'LAST_USED_LNG', newCenter.lng());
            }

            // For each place, get the icon, name and location.
            const bounds = new google.maps.LatLngBounds();

            places.forEach((place) => {
                if (!place.geometry || !place.geometry.location) {
                    console.log("Returned place contains no geometry");
                    return;
                }

                if (place.geometry.viewport) {
                    // Only geocodes have viewport.
                    bounds.union(place.geometry.viewport);
                } else {
                    bounds.extend(place.geometry.location);
                }
            });
            map.fitBounds(bounds);
        });

    }

    toggleLabels() {
        // Unfortunately this will effectively overwrite label visibility styling defined by any custom style.
        if(MapDialog.labelsOn) {
            MapDialog.mapPortal.set('styles', MAP_STYLES.LABELS_OFF);
            MapDialog.labelsOn = false;
        } else {
            MapDialog.mapPortal.set('styles', MAP_STYLES.LABELS_ON);
            MapDialog.labelsOn = true;
        }

    }

    getData(options = {}) {
        return super.getData().object;
    }

    async activateListeners(html) {
        super.activateListeners(html);
        console.log('map-canvas: MapDialog.activateListeners');

        // Ensure Google Maps API is loaded and the map is initialized now that the DOM exists
        await this.ensureMapsApiAndInit();

        const addClick = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };

        addClick('mapCanvasUpdateScene', () => MapCanvas.updateScene(false));
        addClick('mapCanvasGenerateScene', () => MapCanvas.updateScene(true));
        addClick('mapCanvasToggleLabels', () => this.toggleLabels());
        addClick('mapCanvasMaximize', () => this.maximizeDialog());
        // The following elements are not present in the current template; guard them.
        addClick('mapCanvasMoveLeft', () => MapDialog.moveToAdjacentZone('left'));
        addClick('mapCanvasMoveRight', () => MapDialog.moveToAdjacentZone('right'));
        addClick('mapCanvasMoveUp', () => MapDialog.moveToAdjacentZone('up'));
        addClick('mapCanvasMoveDown', () => MapDialog.moveToAdjacentZone('down'));
        addClick('mapCanvasGenerateExpandedScene', () => MapDialog.captureSurroundingZones());
    }

    async ensureMapsApiAndInit() {
        try {
            const MAPS_API_KEY = game.settings.get('map-canvas', 'MAPS_API_KEY');
            if (!window['mapcanvas'].apiLoaded) {
                await $.getScript('https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=default');
                await $.getScript('https://maps.googleapis.com/maps/api/js?libraries=places&v=weekly&key=' + MAPS_API_KEY);
                window['mapcanvas'].apiLoaded = true; // Assume load succeeded if no exception
                console.log('map-canvas: Google Maps API loaded');
            }
            if (!MapDialog.mapInitialized) {
                MapDialog.initMap();
                MapDialog.mapInitialized = true;
                console.log('map-canvas: Map initialized');
            }
        } catch (e) {
            console.error('map-canvas: Failed to load Google Maps API or initialize map', e);
        }
    }

    async _updateObject(event, formData) {
        // TODO: Rethink / Reimplement how we can properly rehydrate a dialog box where users last left it.
        window['mapcanvas'].lastSearch = formData.mapCanvasSearchBox
        this.object = { searchValue: formData.mapCanvasSearchBox, portalActive: true };
        this.element.css({
            height: '100vh',

            top: 0,
            left: 0
        });

    }

    async close() {
        window['mapcanvas'].dialogActive = false;
        window['mapcanvas'].dialog = {}
        await super.close();
    }
}

class MapCanvas extends Application {

    constructor(object, options) {
        super(object, options)

        window['mapcanvas'] = { dialogActive: false, apiLoaded: false };
        // Expose the instance for event handlers defined outside of this class scope
        window.mapCanvasInstance = this;

        $.getScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.3.2/html2canvas.min.js', () => { /* import html2canvas */ });

        Hooks.on("getSceneControlButtons", (controls) => this.addControls(controls));

        // Defensive: Intercept clicks on the tool by delegating to the document.
        // This ensures the button works even if Foundry changes the expected tool callback prop.
        Hooks.on('renderSceneControls', () => {
            try {
                $(document).off('.mapcanvas');
                const sel = [
                    '[data-tool="mapdialog"]',
                    '[data-action="mapdialog"]',
                    'li.control-tool[data-tool="mapdialog"]',
                    'li.control-tool[data-action="mapdialog"]',
                    'li.control-tool[title="Open Map Dialog"]',
                    'button.control-tool[data-tool="mapdialog"]',
                    'button[data-tool="mapdialog"]',
                    'button[title="Open Map Dialog"]',
                    'a.control-tool[data-tool="mapdialog"]'
                ].join(',');
                $(document).on('click.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (click) fired for 'mapdialog'", ev.currentTarget);
                    window.mapCanvasInstance?.openDialog?.();
                });
                $(document).on('pointerdown.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (pointerdown) fired for 'mapdialog'", ev.currentTarget);
                    // Only act on primary button
                    if (ev.button === 0) window.mapCanvasInstance?.openDialog?.();
                });
            } catch (e) {
                console.error('map-canvas: failed to bind delegated click handler', e);
            }
        });

        // Also bind once at ready as a fallback, in case renderSceneControls doesn't fire as expected.
        Hooks.once('ready', () => {
            try {
                $(document).off('.mapcanvas');
                const sel = [
                    '[data-tool="mapdialog"]',
                    '[data-action="mapdialog"]',
                    'li.control-tool[data-tool="mapdialog"]',
                    'li.control-tool[data-action="mapdialog"]',
                    'li.control-tool[title="Open Map Dialog"]',
                    'button.control-tool[data-tool="mapdialog"]',
                    'button[data-tool="mapdialog"]',
                    'button[title="Open Map Dialog"]',
                    'a.control-tool[data-tool="mapdialog"]'
                ].join(',');
                $(document).on('click.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (ready click) fired for 'mapdialog'", ev.currentTarget);
                    window.mapCanvasInstance?.openDialog?.();
                });
                $(document).on('pointerdown.mapcanvas', sel, (ev) => {
                    console.log("map-canvas: delegated handler (ready pointerdown) fired for 'mapdialog'", ev.currentTarget);
                    if (ev.button === 0) window.mapCanvasInstance?.openDialog?.();
                });

                // Capture-phase listeners to bypass stopPropagation from core
                const captureHandler = (ev) => {
                    try {
                        const target = ev.target;
                        if (!target) return;
                        const match = target.closest(sel);
                        if (match) {
                            console.log('map-canvas: capture handler fired for mapdialog', match);
                            window.mapCanvasInstance?.openDialog?.();
                        }
                    } catch (e) {
                        console.error('map-canvas: capture handler error', e);
                    }
                };
                // Store refs so we could remove later if needed
                window.__mapcanvasCaptureHandlers = window.__mapcanvasCaptureHandlers || [];
                document.addEventListener('click', captureHandler, true);
                document.addEventListener('pointerdown', captureHandler, true);
                window.__mapcanvasCaptureHandlers.push(captureHandler);
            } catch (e) {
                console.error('map-canvas: failed to bind delegated click handler at ready', e);
            }
        });

        // Register our settings
        Hooks.once('init', () => {
            MapCanvas.registerSettings().then(() => console.log("MapCanvas Settings Registered."));
            try {
                game.keybindings.register('map-canvas', 'open-dialog', {
                    name: 'Map Canvas: Open Dialog',
                    hint: 'Open the Map Canvas dialog',
                    editable: [
                        { key: 'M', modifiers: ['ALT'] }
                    ],
                    restricted: true,
                    onDown: () => {
                        console.log('map-canvas: keybinding fired (Alt+M)');
                        window.mapCanvasInstance?.openDialog?.();
                        return true;
                    }
                });
            } catch (e) {
                console.warn('map-canvas: failed to register keybinding (non-fatal)', e);
            }
        });
    }

    addControls(controls) {
        if (game.user.isGM) {

            const canvasTools = [
                {
                    // "active" is not needed for plain buttons in v13
                    name: "mapdialog",
                    title: "Open Map Dialog",
                    icon: "fas fa-map-marker-alt",
                    button: true,
                    // In v13, tools should be either a button or a toggle – not both.
                    // Use a plain button so the onClick fires reliably.
                    toggle: false,
                    visible: true,
                    onClick: () => {
                        console.log("map-canvas: 'Open Map Dialog' clicked");
                        // Use the global instance to avoid any context issues
                        if (window?.mapCanvasInstance?.openDialog) return window.mapCanvasInstance.openDialog();
                        if (typeof mapCanvas !== 'undefined' && mapCanvas.openDialog) return mapCanvas.openDialog();
                        try { this.openDialog(); } catch (e) { console.error('map-canvas: openDialog() failed from tool click', e); }
                    },
                    // Some cores use `callback` for buttons; provide it as well
                    callback: () => {
                        console.log("map-canvas: 'Open Map Dialog' callback fired");
                        if (window?.mapCanvasInstance?.openDialog) return window.mapCanvasInstance.openDialog();
                        if (typeof mapCanvas !== 'undefined' && mapCanvas.openDialog) return mapCanvas.openDialog();
                        try { this.openDialog(); } catch (e) { console.error('map-canvas: openDialog() failed from tool callback', e); }
                    },
                    // Extremely defensive: some modules used `onclick` lowercase historically
                    onclick: () => {
                        console.log("map-canvas: 'Open Map Dialog' onclick fired");
                        if (window?.mapCanvasInstance?.openDialog) return window.mapCanvasInstance.openDialog();
                        if (typeof mapCanvas !== 'undefined' && mapCanvas.openDialog) return mapCanvas.openDialog();
                        try { this.openDialog(); } catch (e) { console.error('map-canvas: openDialog() failed from tool onclick', e); }
                    }
                },
                {
                    // "active" is not needed for plain buttons in v13
                    name: "purgetemp",
                    title: "Purge Generated Scenes",
                    icon: "fas fa-backspace",
                    button: true,
                    toggle: false,
                    visible: true,
                    onClick: () => {
                        console.log("map-canvas: 'Purge Generated Scenes' clicked");
                        const SCENE_NAME = game.settings.get("map-canvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    },
                    callback: () => {
                        console.log("map-canvas: 'Purge Generated Scenes' callback fired");
                        const SCENE_NAME = game.settings.get("map-canvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    },
                    onclick: () => {
                        console.log("map-canvas: 'Purge Generated Scenes' onclick fired");
                        const SCENE_NAME = game.settings.get("map-canvas", "DEFAULT_SCENE");
                        game.scenes.filter(s => s.name.startsWith(SCENE_NAME+"_")).forEach((a) => {
                            game.scenes.get(a.id).delete();
                        });
                    }
                }
            ]

            const hudControl = {
                name: "mapcanvas",
                title: "Map Canvas",
                icon: "fas fa-globe",
                visible: true,
                tools: canvasTools,
            }

            // Foundry v12 provided an Array here; v13 provides a plain object whose
            // keys are control set names. Support both shapes.
            try {
                if (Array.isArray(controls)) {
                    controls.push(hudControl);
                } else if (controls && Array.isArray(controls.controls)) {
                    // Some versions expose the array under `controls`
                    controls.controls.push(hudControl);
                } else if (controls && Array.isArray(controls.tools)) {
                    // Fallback: if tools array is provided directly
                    controls.tools.push(hudControl);
                } else if (controls && typeof controls === 'object') {
                    // v13-style object map of control groups
                    controls[hudControl.name] = hudControl;
                } else {
                    console.warn("map-canvas: Unexpected controls structure in getSceneControlButtons hook; skipping control injection.", controls);
                }
                console.log("map-canvas: Scene Controls injected (mapcanvas)");
            } catch (e) {
                console.error("map-canvas: Failed to add scene control: ", e);
            }
        }
    }

    openDialog() {
        console.log("map-canvas: openDialog() invoked");
        if (!window['mapcanvas'].dialogActive) { 
            window['mapcanvas'].dialogActive = true;
        } else { 
            console.log("map-canvas: dialog already active; skipping new render");
            return;
        }
    
        try {
            window['mapcanvas'].dialog = new MapDialog();
        } catch (e) {
            console.error("map-canvas: Failed to construct MapDialog", e);
            window['mapcanvas'].dialogActive = false;
            return;
        }
        window['mapcanvas'].dialog.render(true);
    
        // Set the last used scene name and zoom in the dialog box when UI is opened
    }

    static async updateScene(generateNewScene = false) {
        let zoom_multipler = 4;
        if (window.screen.height === 2880) {
            zoom_multipler = 8;
        }
        const map_scale = {};
        for (let i = 21; i > 0; i--) {
            map_scale[i] = Math.pow(2, 21 - i) * zoom_multipler;
        }
        const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");
    
        let sceneName = document.querySelector('#mapCanvasSceneName').value;
        if (!sceneName) {
            sceneName = (generateNewScene) ? DEFAULT_SCENE + "_" + new Date().getTime() : DEFAULT_SCENE;
        }

        // Save the scene name for future use
        game.settings.set("map-canvas", "LAST_USED_SCENE_NAME", sceneName);

        const currentZoom = MapDialog.mapPortal.getZoom();
        sceneName += " Zoom:" +currentZoom;
        let scene = game.scenes.find(s => s.name.startsWith(sceneName));
        let test_scene = game.scenes.find(s => s.name = "Citi Field Zoom:17");
        console.log("Test Scene:", test_scene);
        if (!scene) {

            // Create our scene if we don't have it.
            await Scene.create({ name: sceneName }).then(s => {
                scene = s;
                ui.notifications.info('Map Canvas | Created scene: ' + sceneName);
            });
    
            const currentZoom = MapDialog.mapPortal.getZoom();
            await scene.update({ "grid.distance": map_scale[currentZoom] }).then(updatedScene => {
                ui.notifications.info("Scene grid updated successfully");
            });

            // Save the current zoom level for future use
            game.settings.set("map-canvas", "LAST_USED_ZOOM", currentZoom);

            console.log("Scene:", scene);
        }

        await MapCanvas.getMapCanvasImage().then(async (image) => {
            const USE_STORAGE = game.settings.get("map-canvas", "USE_STORAGE");
            const DEFAULT_SCENE = game.settings.get("map-canvas", "DEFAULT_SCENE");

            // TODO: Make some of these user-definable. Perhaps leveraging Scene.createDialog().
            const mapElement = document.getElementById('mapPortal');

            let updates = {
                _id: scene.id,
                //img: image.dataUrl,
                background: { src: image.dataUrl },
                //width: width,
                width: 4000,
                //height: height,
                height: 3000,

                padding: 0.01,
                gridType: 0
            }

            if(USE_STORAGE) {
                const fileName = `${DEFAULT_SCENE}_${new Date().getTime()}_BG.png`
                const blob = new ImageDataConverter(image.dataUrl).dataURItoBlob();
                const tempFile = new File([blob], fileName, {
                    type: "image/png",
                    lastModified: new Date(),
                });

                await FilePicker.createDirectory('user', 'map-canvas').catch((e) => {
                    console.log(e);
                });

                await FilePicker.upload('data', 'map-canvas', tempFile).then((res) => {
                    console.log("UploadRes:", res)
                    updates.background = { src: res.path };
                    //updates.img = res.path;
                });

            }

            console.log("Image: ", updates);

            await Scene.updateDocuments([updates]).then(() => {
                ui.notifications.info(" Map Canvas | Updated Scene: " + sceneName)
            });
            
        });
    }

    // TODO: Kinda violates single-responsibility principle, method should be moved to the MapDialog class.
    static async getMapCanvasImage() {
        const mapPortal = document.getElementById('mapPortal');
    
        // Remove controls before taking map capture
        MapDialog.mapPortal.setOptions({ disableDefaultUI: true });
        await sleep(100); // Wait for map to update view

        let tempImage = new Image();
        let imageDems = {};
    
        // Capture the map image
        function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
        
        await html2canvas(document.querySelector("#mapPortal"), { useCORS: true }).then(mapCanvas => {
            tempImage.onload = (_) => {
                imageDems = { width: _.currentTarget.naturalWidth, height: _.currentTarget.naturalHeight };
            };
            tempImage.src = mapCanvas.toDataURL();
        });

        MapDialog.mapPortal.setOptions({ disableDefaultUI: false });

        return { dataUrl: tempImage.src, dems: imageDems };
    }
    
    static async registerSettings() {
        game.settings.register('map-canvas', 'LAST_USED_SCENE_NAME', {
            name: 'Last Used Scene Name',
            hint: 'Stores the last used scene name for the map canvas.',
            scope: 'client', // This specifies that the setting is stored for each individual user.
            config: false, // This specifies that the setting does not appear in the settings menu.
            type: String,
            default: ''
        });
    
        // Register last used zoom setting
        game.settings.register('map-canvas', 'LAST_USED_ZOOM', {
            name: 'Last Used Zoom Level',
            hint: 'Stores the last used zoom level for the map canvas.',
            scope: 'client',
            config: false,
            type: Number,
            default: 1 // Default zoom level, adjust as needed
        });
        // Register setting for latitude
        game.settings.register('map-canvas', 'LAST_USED_LAT', {
            name: 'Last Used Latitude',
            scope: 'client',
            config: false,
            type: Number,
            default: 40.7571, // Default latitude, adjust as needed
        });
    
        // Register setting for longitude
        game.settings.register('map-canvas', 'LAST_USED_LNG', {
            name: 'Last Used Longitude',
            scope: 'client',
            config: false,
            type: Number,
            default: -73.8458, // Default longitude, adjust as needed
        });
        await game.settings.register('map-canvas', 'MAPS_API_KEY', {
            name: 'Google Maps Javascript API Key',
            hint: 'Google how to get a Maps Javascript API Key.',
            scope: 'world',
            config: true,
            type: String,
            filePicker: false,
            default: "",
        });

        await game.settings.register('map-canvas', 'DEFAULT_SCENE', {
            name: 'Default Scene Name',
            hint: 'Used when running canvas updates.',
            scope: 'world',
            config: true,
            type: String,
            filePicker: false,
            default: "MapCanvasScene",
        });

        await game.settings.register('map-canvas', 'USE_STORAGE', {
            name: 'Store Images [Experimental]',
            hint: 'Stores images instead of embedding them in the scene document, should speed up image propagation.',
            scope: 'world',
            config: true,
            type: Boolean,
            filePicker: false,
            default: false,
        });

        await game.settings.register('map-canvas', 'DEFAULT_MAP_MODE', {
            name: 'Default Map Mode',
            hint: 'Determines what display mode loads by default when opening the map dialog.',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                HYBRID: "HYBRID",
                ROADMAP: "ROADMAP",
                SATELLITE: "SATELLITE",
                TERRAIN: "TERRAIN",
            },
            default: "HYBRID"
        });

        await game.settings.register('map-canvas', "DEFAULT_MAP_STYLE", {
            name: 'Default Maps Style',
            hint: 'See: https://mapstyle.withgoogle.com/',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                Standard: "Standard",
                Silver: "Silver",
                Retro: "Retro",
                Dark: "Dark",
                Night: "Night",
                Aubergine: "Aubergine",
                Custom: "Custom"
            },
            default: "Standard"
        });

        await game.settings.register('map-canvas', "CUSTOM_MAP_STYLE_JSON", {
            name: 'Custom Map Styling JSON',
            hint: 'Optional: Used when selecting \'Custom\' from the styles drop down.',
            scope: 'world',
            config: true,
            type: String,
            default: ""
        });

    }

    // A failed stab at canvas based image scaling lifted from SO for rendering cleaner scaled scene backgrounds.
    static canvasScale(img, dems, scale = 2) {
        let src_canvas = document.createElement('canvas');
        src_canvas.width = dems.width;
        src_canvas.height = dems.height;

        console.log("Dems: ", dems.width);

        let src_ctx = src_canvas.getContext('2d');
        src_ctx.drawImage(img, 0, 0);
        let src_data = src_ctx.getImageData(0, 0, 640, 480).data;

        let sw = dems.width * scale;
        let sh = dems.height * scale;

        console.log({ sw: sw, sh: sh });
        let dst_canvas = document.createElement('canvas');
        dst_canvas.width = sw;
        dst_canvas.height = sh;
        let dst_ctx = dst_canvas.getContext('2d');

        let dst_imgdata = dst_ctx.createImageData(200, 200);
        let dst_data = dst_imgdata.data;

        let src_p = 0;
        let dst_p = 0;
        for (let y = 0; y < this.height; ++y) {
            for (let i = 0; i < scale; ++i) {
                for (let x = 0; x < this.width; ++x) {
                    let src_p = 4 * (y * this.width + x);
                    for (let j = 0; j < scale; ++j) {
                        let tmp = src_p;
                        dst_data[dst_p++] = src_data[tmp++];
                        dst_data[dst_p++] = src_data[tmp++];
                        dst_data[dst_p++] = src_data[tmp++];
                        dst_data[dst_p++] = src_data[tmp++];
                    }
                }
            }
        }
        dst_ctx.putImageData(dst_imgdata, 0, 0);
        console.log(dst_canvas);
        return dst_canvas.toDataURL();
    }

}

const mapCanvas = new MapCanvas();