/*
 * L.GisFileKml turns GisFile API box (http://gisfile.com/api/1.0/doc/box) data into a Leaflet layer.
 */
/*
if (!L.Util.template) {
    L.Util.template = function (str, data) {
        return str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
            var value = data[key];
            if (!data.hasOwnProperty(key)) {
                throw new Error('No value provided for variable ' + str);
            } else if (typeof value === 'function') {
                value = value(data);
            }

            return value;
        });
    }
}
*/
L.GisFileTip = L.Class.extend({
    initialize: function (map) {
        this._map = map;
        this._popupPane = map._panes.popupPane;
        this._container = L.DomUtil.create('div', 'leaflet-tooltip', this._popupPane);
    },

    dispose: function () {
        if (this._container) {
            this._popupPane.removeChild(this._container);
            this._container = null;
        }
    },

    updateContent: function (labelText) {
        if (!this._container) {
            return this;
        }
        L.DomUtil.addClass(this._container, 'leaflet-tooltip-single');
        this._container.innerHTML = '<span>' + labelText.text + '</span>';
        return this;
    },

    updatePosition: function (latlng) {
        var pos = this._map.latLngToLayerPoint(latlng),
            tooltipContainer = this._container;

        if (this._container) {
            tooltipContainer.style.visibility = 'inherit';
            L.DomUtil.setPosition(tooltipContainer, pos);
        }

        return this;
    }
});

L.GisFileKml = L.Class.extend({
    includes: L.Mixin.Events
    , timer: null
    , mouseMoveTimer: null
    , counter: 0
    , options: {
        url: '//gisfile.com/layer/{l}/{z}/{x}/{y}.kml'
        , layer: ''
        , opacity: 1
        , attribution: '<a href="http://gisfile.com" target="_blank">GISFile</a>'
        , showobjects: true
        , minZoom : 0
        , maxZoom : 20
        , minSize : 10
    }

    , initialize: function (options) {
        var that = this;
        L.setOptions(that, options);
        that._hash = {};
        that._tiles = {};
        that._mouseIsDown = false;
        that._popupIsOpen = false;
    }

    , setOptions: function (newOptions) {
        var that = this;
        L.setOptions(that, newOptions);
        that._update();
    }

    , onAdd: function (map) {
        var that = this;
        that._map = map;

        if (L.GisFileTip) {
            that._tips = new L.GisFileTip(that._map);
        }

        map.on('viewreset', that._update, that);
        map.on('moveend', that._update, that);
        map.on('zoomend', that._update, that);
        map.on('mousemove', that._mousemove, that);
        map.on('mouseout', that._mouseout, that);
        map.on('mousedown', that._mousedown, that);
        map.on('mouseup', that._mouseup, that);
        map.on('popupopen', that._popup_open, that);
        map.on('popupclose', that._popup_close, that);

        that._update();
    }

    , onRemove: function (map) {
        var that = this;

        map.off('viewreset', that._update, that);
        map.off('moveend', that._update, that);
        map.off('zoomend', that._update, that);
        map.off('mousemove', that._mousemove, that);
        map.off('mouseout', that._mouseout, that);
        map.off('mousedown', that._mousedown, that);
        map.off('mouseup', that._mouseup, that);
        map.off('popupopen', that._popup_open, that);
        map.off('popupclose', that._popup_close, that);
        
        if (L.GisFileTip && this._tips != undefined) {
            this._tips.dispose();
            that._tips = null;
        }
        
        this._popup_close();
        this._hideFeature();
        
        if (this._layer) {
            this._layer.clearLayers();            
            if (this._map.hasLayer( this._layer))
                this._map.removeLayer( this._layer);
        }
        
        if (this._lable && this._map.hasLayer( this._lable)) {
            this._lable.clearLayers();
            this._map.removeLayer( this._lable);
        }        
    }

   , addTo: function (map) {
        map.addLayer(this);
        return this;
    }

    , getAttribution: function () {
        return this.options.attribution;
    }

    , _hideFeature: function () {
    	var that = this;
        if (that._feature && !that._popupIsOpen) {
            that._feature.polygon.off('mouseout');
            
            if (!that.options.showobjects || (that._layer && !that._layer.hasLayer( that._feature.polygon))) {
                that._map.removeLayer(that._feature.polygon);
            } else {
                that._feature.polygon.setStyle( {fillColor: 'none', weight: 1, opacity: 1, color: '#A9A9A9'});
                
                if (that.options.style) {
                    that._feature.polygon.setStyle(that.options.style(that._feature));
                }
            }
            
            that._feature = null;
        }
    }

    , _showHash:function() {
        if (this._layer && this._map.hasLayer( this._layer)) {
            this._layer.clearLayers();
            this._map.removeLayer( this._layer);
        }
                
        if (!this._layer) {
            this._layer = L.layerGroup();
        }
        
        if (!this._map.hasLayer( this._layer)) {
            this._map.addLayer( this._layer);
        }
        
        if (this.options.lable) {
            if (this._lable && this._map.hasLayer( this._lable)) {
                this._lable.clearLayers();
                this._map.removeLayer( this._lable);
            }
            
            if (!this._lable) {
                this._lable = L.layerGroup();
            }
            
            if (!this._map.hasLayer( this._lable)) {
                this._map.addLayer( this._lable);
            }
        }

        var zoom = this._map.getZoom();
        
        if (zoom >= this.options.minZoom && zoom <= this.options.maxZoom) {
            for (var i in this._hash) {
                this._drawHash( this._hash[i]);
            } 
        } else {
            if (L.GisFileTip && this._tips != undefined && this._tips != null) {
                this._hideFeature();
                this._tips.dispose();
                this._tips = null;
            }
        }
    }

    , _drawHash:function(hash) {
        var bounds = this._map.getBounds();
        var p1 = this._map.latLngToLayerPoint( hash.bounds.getSouthWest());
        var p2 = this._map.latLngToLayerPoint( hash.bounds.getNorthEast());
        
        //var wheight = Math.max($(document).height(), $(window).height()); 
        //var wwidth = Math.max($(document).width(), $(window).width()); 

        if (p1.x -p2.x >= this.options.minSize || p1.y -p2.y >= this.options.minSize)
        {
            if (bounds.contains( hash.bounds) || bounds.intersects( hash.bounds)) {
                hash.polygon.setStyle( {fillColor: 'none', weight: 1, opacity: 1, color: '#A9A9A9'});
                /*
                if (this._styleIndex && hash.style && this._styleIndex[ hash.style]) {
                    var c = this.get1( this._styleIndex[ hash.style], "color");
                }
                */
                if (this.options.style) {
                    hash.polygon.setStyle(this.options.style(hash));
                }

                if (!this._map.hasLayer( hash.polygon)) {
                    hash.polygon.addTo(this._layer);
                }
                
                if (p1.x -p2.x >= this.options.minSize || p1.y -p2.y >= this.options.minSize) {
                    if (this.options.lable && this.options.lable.name) {
                        var xy = hash.bounds.getCenter(), s = hash[ this.options.lable.name] != undefined ? hash[ this.options.lable.name] : "";
                        if (this.options.lable.area) s = s +" " +parseFloat( hash[ this.options.lable.area]).toFixed(2);
                        var l = new L.LabelOverlay( xy, s.trim(), {
                            minZoom: this.options.lable.minZoom ? this.options.lable.minZoom : this.options.minZoom, 
                            maxZoom: this.options.lable.maxZoom ? this.options.lable.maxZoom : this.options.maxZoom});
                        this._lable.addLayer( l);
                    }
                }
            }
        }
    }
    
    , _showFeature:function(feature, point) {
    	var that = this;
        if (!((that._feature && that._feature.id==feature.id) || that._popupIsOpen)) {
            that._hideFeature();

            that._feature = feature;
            feature.polygon.setStyle( {fillColor: 'blue', weight: 1, opacity: 0.3, color: 'blue'});

            if (that.options.onActiveFeature) {
                that.options.onActiveFeature(that._feature, that._feature.polygon);
            }

            if (that.options.style) {
                that._feature.polygon.setStyle(that.options.style(that._feature));
            }

            if (L.GisFileTip) {
                if (that._tips == null) that._tips = new L.GisFileTip(that._map);
                that._tips.updateContent({ text: that._feature.name });
                that._tips.updatePosition( point); //that._feature.bounds.getCenter());
            }
            
            that._feature.polygon
            .on('mouseout', function (e) {
                var size = that._map.getSize();
                if (e.containerPoint.x<0 || e.containerPoint.y<0 || e.containerPoint.x>(size.x-10) || e.containerPoint.y>(size.y-10)) {
                    that._hideFeature();
                }
                if (L.GisFileTip) {
                    this._tips = null;
                }
            })
            .addTo(that._map);
        }
    }

    , _mousemove: function (e) {
    	var that = this;
        var zoom = this._map.getZoom();

        if (zoom >= this.options.minZoom && zoom <= this.options.maxZoom) 
    	if (!that._mouseIsDown) {
            var point = e.latlng
                , features = that._filter(that._hash, function (item) {
                    var p1 = that._map.latLngToLayerPoint( item.bounds.getSouthWest());
                    var p2 = that._map.latLngToLayerPoint( item.bounds.getNorthEast());
                    
                    return ((p1.x -p2.x >= that.options.minSize || p1.y -p2.y >= that.options.minSize) && item.bounds.contains(point) && that._pointInPolygon(point, item.polygon))
                });

            if (features.length>0) {
                var feature = (features.length == 1 ? features[0] : that._chooseBestFeature(features));
                    that._showFeature(feature, e.latlng);
                } else {
                    that._hideFeature();
                }
    	}
    }

    , _mousedown: function () {
    	this._mouseIsDown = true;
    }

    , _mouseup: function () {
    	this._mouseIsDown = false;
    }

    , _mouseout: function () {
        this._hideFeature();
    }

    , _popup_open: function () {
    	this._popupIsOpen = true;
    }

    , _popup_close: function () {
    	this._popupIsOpen = false;
    }

    , _chooseBestFeature: function (features) {
        var that = this
            //, bestLookingArea = that._boundsArea(that._map.getBounds())/12
            , bestFeatureIndex = 0
            , bestFeatureScale = that._boundsArea(features[0].bounds); //bestLookingArea;

        //if (bestFeatureScale < 1) {bestFeatureScale = 1/bestFeatureScale}

        for (var i=1; i<features.length;i++) {
            var featureArea = that._boundsArea(features[i].bounds)
              , featureScale = featureArea; //bestLookingArea;
            //if (featureScale < 1) {featureScale = 1/featureScale}

            if (featureScale<bestFeatureScale) {
                bestFeatureIndex = i;
                bestFeatureScale = featureScale;
            }
        }

        return features[bestFeatureIndex];
    }

    , _boundsArea: function(bounds) {
        var sw = bounds.getSouthWest()
            , ne = bounds.getNorthEast();
        return (ne.lat-sw.lat)*(ne.lat-sw.lat)+(ne.lng-sw.lng)*(ne.lng-sw.lng)
    }

    , _filter: function(obj, predicate) {
        var res=[];
        
        $.each(obj, function(index,item) {
            if (predicate(item)) {res.push(item)}
        });

        return res;
    }

    , _pointInPolygon: function (point, polygon) {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

        var x = point.lng
        , y = point.lat
        , poly = polygon.getLatLngs()
        , inside = false;

        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {

            var xi = poly[i].lng, yi = poly[i].lat
            , xj = poly[j].lng, yj = poly[j].lat
            , intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;

        }

        return inside;
    }

    , _update: function () {
        
        var that = this;

        if (that.timer) {
            window.clearTimeout(that.timer);
        }

        that.timer = window.setTimeout(function() {
            if (that.options.showobjects) {
                that._showHash();
            }
            
            var zoom = that._map.getZoom();
            
            if (zoom > that.options.maxZoom || zoom < that.options.minZoom) {
                return;
            }

            var tbounds = that._map.getPixelBounds(),
                tileSize = 256;

            var bounds = L.bounds(
                tbounds.min.divideBy(tileSize)._floor(),
                tbounds.max.divideBy(tileSize)._floor());

            var queue = [], center = bounds.getCenter();
            var j, i, point;

            for (j = bounds.min.y; j <= bounds.max.y; j++) {
                for (i = bounds.min.x; i <= bounds.max.x; i++) {
                    point = new L.Point(i, j);

                    if (that._tileShouldBeLoaded(point)) {
                        queue.push(point);
                    }
                }
            }

            var tilesToLoad = queue.length;
            if (tilesToLoad === 0) { return; }

            queue.sort(function (a, b) {
                return a.distanceTo(center) - b.distanceTo(center);
            });
            
            that.counter += tilesToLoad;

            for (i = 0; i < tilesToLoad; i++) {
                that._loadTile( queue[i]);
            }
        },0);
    },

    // -------------------------------------------------------------------------
    
    _loadTile: function (tilePoint) {
        var that = this;
        this._adjustTilePoint(tilePoint);
        var url = that.getTileUrl(tilePoint);

        if (url.indexOf( ".kmz") == -1) {
            $.ajax({
                url : url
                , async: true
                , success: function(data) {
                    that.parseKml( data, that);
                    /*
                    var gj = {
                        type: 'FeatureCollection',
                        features: [],
                        styles: []
                    };
                    if (data) {
                        var placemarks = that.get( data, 'Placemark'),
                            styles = that.get( data, 'Style'), styleIndex = {};

                        for (var k = 0; k < styles.length; k++) {
                            styleIndex['#' +that.attr(styles[k], 'id')] = styles[k]; //okhash(xml2str(styles[k])).toString(16);
                        }                 

                        that._styleIndex = styleIndex;

                        for (var j = 0; j < placemarks.length; j++) {
                            var polygon = that.getPlacemark(placemarks[j], that);
                            var item = polygon[0];

                            that._hash[ item.properties.uid] = {
                                id: item.properties.uid
                                , name: item.properties.name && item.properties.name.length > 0 ? item.properties.name : item.properties.description
                                , url : ''
                                , style : item.properties.styleUrl
                                , bounds: item.properties.bounds
                                , polygon: new L.Polygon(item.geometry.coordinates)
                            };

                            if (!that._hash[ item.properties.uid].bounds) {
                                that._hash[ item.properties.uid].bounds = that._hash[ item.properties.uid].polygon.getBounds();
                            }

                            if (that.options.showobjects) {
                                that._drawHash( that._hash[ item.properties.uid]);
                            }
                        } 
                    }
                    */
                    that._tiles[tilePoint.x + ':' +tilePoint.y] = '';
                    that.counter--;
                }
            })            
        } else if (JSZip) {
            if (window.XMLHttpRequest === undefined) {
                window.XMLHttpRequest = function() {
                    try {
                        return new ActiveXObject("Microsoft.XMLHTTP.6.0");
                    }
                    catch (e1) {
                        try {
                            return new ActiveXObject("Microsoft.XMLHTTP.3.0");
                        }
                        catch (e2) {
                            throw new Error("XMLHttpRequest is not supported");
                        }
                    }
                };
            }

            var oReq = new XMLHttpRequest();
            oReq.open("GET", url, true);
            oReq.responseType = "arraybuffer";
            oReq.onload = function (oEvent) {
                if (oReq.response && oReq.response.byteLength > 0) {
                    var arrayBuffer = oReq.response;
                    if (arrayBuffer) {
                        var z = new JSZip();
                        z.load(arrayBuffer);

                        $.each(z.files, function (index, zipEntry) {
                            var data = z.file(zipEntry.name).asText();
                            that.parseKml( data, that);
                        })
                    }
                }
                that._tiles[tilePoint.x + ':' +tilePoint.y] = '';
                that.counter--;
            };
            oReq.send(null);
        }
    },
    
    parseKml: function (data, that) {
        var gj = {
            type: 'FeatureCollection',
            features: [],
            styles: []
        };
        if (data) {
            if (typeof data == 'string') {
                data = ( new window.DOMParser() ).parseFromString(data, "text/xml");
            }            
            
            var placemarks = that.get( data, 'Placemark'),
                styles = that.get( data, 'Style'), styleIndex = {};

            for (var k = 0; k < styles.length; k++) {
                styleIndex['#' +that.attr(styles[k], 'id')] = styles[k]; //okhash(xml2str(styles[k])).toString(16);
            }                 

            that._styleIndex = styleIndex;

            for (var j = 0; j < placemarks.length; j++) {
                var polygon = that.getPlacemark(placemarks[j], that);
                var item = polygon[0];

                that._hash[ item.properties.uid] = {
                    id: item.properties.uid
                    , name: item.properties.name && item.properties.name.length > 0 ? item.properties.name : item.properties.description
                    , url : ''
                    , style : item.properties.styleUrl
                    , bounds: item.properties.bounds
                    , polygon: new L.Polygon(item.geometry.coordinates)
                };

                if (!that._hash[ item.properties.uid].bounds) {
                    that._hash[ item.properties.uid].bounds = that._hash[ item.properties.uid].polygon.getBounds();
                }

                if (that.options.showobjects) {
                    that._drawHash( that._hash[ item.properties.uid]);
                }
            } 
        }                           
    },
    
    _tileShouldBeLoaded: function (tilePoint) {
        if ((tilePoint.x + ':' + tilePoint.y) in this._tiles) {
            return false; // already loaded
        }

        var options = this.options;

        if (!options.continuousWorld) {
            var limit = this._getWrapTileNum();

            // don't load if exceeds world bounds
            if ((options.noWrap && (tilePoint.x < 0 || tilePoint.x >= limit)) ||
                tilePoint.y < 0 || tilePoint.y >= limit) { return false; }
        }

        if (options.bounds) {
            var tileSize = options.tileSize,
                nwPoint = tilePoint.multiplyBy(tileSize),
                sePoint = nwPoint.add([tileSize, tileSize]),
                nw = this._map.unproject(nwPoint),
                se = this._map.unproject(sePoint);

            // TODO temporary hack, will be removed after refactoring projections
            // https://github.com/Leaflet/Leaflet/issues/1618
            if (!options.continuousWorld && !options.noWrap) {
                nw = nw.wrap();
                se = se.wrap();
            }

            if (!options.bounds.intersects([nw, se])) { return false; }
        }

        return true;
    },
    
    getTileUrl: function (tilePoint) {
        return L.Util.template(this.options.url, L.extend({
            s: '',
            l: this.options.layer,
            z: tilePoint.z,
            x: tilePoint.x,
            y: tilePoint.y
        }, this.options));
    },
    
    _getZoomForUrl: function () {
        var options = this.options,
            zoom = this._map.getZoom();

        //if (options.zoomReverse) {
        //    zoom = options.maxZoom - zoom;
        //}

        return zoom; // +options.zoomOffset;
    },
    
    _getWrapTileNum: function () {
        // TODO refactor, limit is not valid for non-standard projections
        return Math.pow(2, this._getZoomForUrl());
    },
    
    _adjustTilePoint: function (tilePoint) {
        var limit = this._getWrapTileNum();

        /*
        // wrap tile coordinates
        if (!this.options.continuousWorld && !this.options.noWrap) {
            tilePoint.x = ((tilePoint.x % limit) + limit) % limit;
        }

        if (this.options.tms) {
            tilePoint.y = limit - tilePoint.y - 1;
        }
        */
        tilePoint.z = this._getZoomForUrl();
    },
    
    // -------------------------------------------------------------------------
        
    removeSpace : (/\s*/g),
    trimSpace : (/^\s*|\s*$/g),
    splitSpace : (/\s+/),
    geotypes : ['Polygon', 'LineString', 'Point', 'Track', 'gx:Track'], 
        
    get : function(x, y) { return x.getElementsByTagName(y); }, 
    attr : function (x, y) { return x.getAttribute(y); },
    attrf : function (x, y) { return parseFloat(attr(x, y)); },
    get1 : function(x, y) { var n = x.getElementsByTagName(y); return n.length ? n[0] : null; }, 
    norm : function (el) { if (el.normalize) { el.normalize(); } return el; },
    numarray : function (x) {
        for (var j = 0, o = []; j < x.length; j++) o[j] = parseFloat(x[j]);
        var c = []; c[1] = o[0]; c[0] = o[1];
        return c;
    },
    clean : function (x) {
        var o = {};
        for (var i in x) if (x[i]) o[i] = x[i];
        return o;
    },
    nodeVal : function (x) {
        if (x) { this.norm(x); }
        return (x && x.firstChild && x.firstChild.nodeValue) || '';
    },
    coord1 : function (v) { return this.numarray(v.replace(this.removeSpace, '').split(',')); },
    coord : function (v) {
        var coords = v.replace(this.trimSpace, '').split(this.splitSpace),
            o = [];
        for (var i = 0; i < coords.length; i++) {
            o.push(this.coord1(coords[i]));
        }
        return o;
    },
    coordPair : function (x) {
        var ll = [attrf(x, 'lon'), attrf(x, 'lat')],
            ele = get1(x, 'ele');
        if (ele) ll.push(parseFloat(nodeVal(ele)));
        return ll;
    },
    fc : function () {
        return {
            type: 'FeatureCollection',
            features: [],
            styles: []
        };
    },
    getXmlStr : function (xml) {
      if (window.ActiveXObject) { return xml.xml; }
      var str = new XMLSerializer().serializeToString(xml);
      str = str.split(" ").join("");
      return '<xmp>' +str +'</xmp>';
    },
    xml2str : function (str) { 
        var serializer;
        if (typeof XMLSerializer !== 'undefined') {
            serializer = new XMLSerializer();
        } else if (typeof exports === 'object' && typeof process === 'object' && !process.browser) {
            serializer = new (require('xmldom').XMLSerializer)();
        }
        return serializer.serializeToString(str); 
    },
    kmlColor: function (v) {
        var color, opacity;
        v = v || "";
        if (v.substr(0, 1) === "#") v = v.substr(1);
        if (v.length === 6 || v.length === 3) color = v;
        if (v.length === 8) {
            opacity = parseInt(v.substr(0, 2), 16) / 255;
            color = v.substr(2);
        }

        if (color.length == 6) {
            color = "#" +color.substr(4, 2) +color.substr(2, 2) +color.substr(0, 2);
        }

        return [color, isNaN(opacity) ? undefined : opacity];
    },
    gxCoord: function (v) { 
        return numarray(v.split(' ')); 
    },
    gxCoords: function (root) {
        var elems = get(root, 'coord', 'gx'), coords = [];
        if (elems.length === 0) elems = get(root, 'gx:coord');
        for (var i = 0; i < elems.length; i++) coords.push(gxCoord(nodeVal(elems[i])));
        return coords;
    },
    getGeometry: function (root) {
        var geomNode, geomNodes, i, j, k, geoms = [];
        //var geotypes = this.geotypes, get = this.get, get1 = this.get1, getGeometry= this.getGeometry;
        if (this.get1(root, 'MultiGeometry')) return this.getGeometry(this.get1(root, 'MultiGeometry'));
        if (this.get1(root, 'MultiTrack')) return this.getGeometry(this.get1(root, 'MultiTrack'));
        if (this.get1(root, 'gx:MultiTrack')) return this.getGeometry(this.get1(root, 'gx:MultiTrack'));
        for (i = 0; i < this.geotypes.length; i++) {
            geomNodes = this.get(root, this.geotypes[i]);
            if (geomNodes) {
                for (j = 0; j < geomNodes.length; j++) {
                    geomNode = geomNodes[j];
                    /* if (this.geotypes[i] == 'Point') {
                        geoms.push({
                            type: 'Point',
                            coordinates: this.coord1(this.nodeVal(this.get1(geomNode, 'coordinates')))
                        });
                    } else */ if (this.geotypes[i] == 'LineString') {
                        geoms.push({
                            type: 'LineString',
                            coordinates: this.coord(this.nodeVal(this.get1(geomNode, 'coordinates')))
                        });
                    } else if (this.geotypes[i] == 'Polygon') {
                        var rings = this.get1(geomNode, 'Polygon')  ? this.get(geomNode, 'Polygon') : this.get(geomNode, 'LinearRing'),
                            coords = [];
                        for (k = 0; k < rings.length; k++) {
                            coords.push(this.coord(this.nodeVal(this.get1(rings[k], 'coordinates'))));
                        }
                        geoms.push({
                            type: 'Polygon',
                            coordinates: coords
                        });
                    } /* else if (this.geotypes[i] == 'Track' ||
                        this.geotypes[i] == 'gx:Track') {
                        geoms.push({
                            type: 'LineString',
                            coordinates: this.gxCoords(geomNode)
                        });
                    } */
                }
            }
        }
        return geoms;
    },
    getPlacemark : function (root, that) {
        var geoms = that.getGeometry(root, that), i, properties = {}, styles = {},
            uid = that.attr( root, 'id');
            name = that.nodeVal(that.get1(root, 'name')),
            styleUrl = that.nodeVal(that.get1(root, 'styleUrl')),
            description = that.get1(root, 'description'),
            timeSpan = that.get1(root, 'TimeSpan'),
            extendedData = that.get1(root, 'ExtendedData'),
            lineStyle = that.get1(root, 'LineStyle'),
            polyStyle = that.get1(root, 'PolyStyle');
            
            if (description) {
                if (description) description = description.innerHTML;
                if (description.indexOf( "<![CDATA[") > -1) description = description.substr(description.indexOf("<![CDATA[", 1) +9).trim();
                if (description.indexOf( "<br>") > -1) description = description.substr(0, description.indexOf("<br>", 1)).trim();
                if (description.indexOf( "]") > -1) description = description.substr(0, description.indexOf("]", 1)).trim();
            }

        var region = that.get1( root, 'Region');
        if (region) {
            var location = that.get1( region, 'LatLonAltBox');
            
            if (location) {
                properties.bounds = L.latLngBounds( [that.nodeVal(that.get1( location, 'south')), that.nodeVal(that.get1( location, 'west'))],
                                                    [that.nodeVal(that.get1( location, 'north')), that.nodeVal(that.get1( location, 'east'))]);
            }
        }

        if (!geoms.length) return [];
        if (name) properties.name = name;
        if (styleUrl && that._styleIndex[styleUrl]) {
            properties.styleUrl = styleUrl;
            //properties.styleHash = styleIndex[styleUrl];
            var style = that._styleIndex[styleUrl];
            lineStyle = that.get1(style, 'LineStyle'),
            polyStyle = that.get1(style, 'PolyStyle');
        }
        if (description) properties.description = description;
        if (timeSpan) {
            var begin = nodeVal(get1(timeSpan, 'begin'));
            var end = nodeVal(get1(timeSpan, 'end'));
            properties.timespan = { begin: begin, end: end };
        }
        if (uid) properties.uid = uid;
        if (lineStyle) {
            var linestyles = that.kmlColor(that.nodeVal(that.get1(lineStyle, 'color'))),
                color = linestyles[0],
                opacity = linestyles[1],
                width = parseFloat(that.nodeVal(that.get1(lineStyle, 'width')));

            if (color) styles.color = color;
            if (!isNaN(opacity)) styles['opacity'] = opacity;
            if (!isNaN(width)) styles['weight'] = width;
            //stroke, Boolean, true 
        }
        if (polyStyle) {
            var polystyles = that.kmlColor(nodeVal(get1(polyStyle, 'color'))),
                pcolor = polystyles[0],
                popacity = polystyles[1],
                fill = nodeVal(get1(polyStyle, 'fill')),
                outline = nodeVal(get1(polyStyle, 'outline'));

            if (pcolor) styles.fillColor = pcolor;
            if (!isNaN(popacity)) styles['fillOpacity'] = popacity; 
            else if (fill) styles['fillOpacity'] = fill === "1" ? 1 : 0;
            if (outline && !styles['opacity']) styles['opacity'] = outline === "1" ? 1 : 0;
            //fill, Boolean
        }
        if (extendedData) {
            var datas = get(extendedData, 'Data'),
                simpleDatas = get(extendedData, 'SimpleData');

            for (i = 0; i < datas.length; i++) {
                properties[datas[i].getAttribute('name')] = nodeVal(get1(datas[i], 'value'));
            }
            for (i = 0; i < simpleDatas.length; i++) {
                properties[simpleDatas[i].getAttribute('name')] = nodeVal(simpleDatas[i]);
            }
        }
        return [{
            type: 'Feature',
            geometry: (geoms.length === 1) ? geoms[0] : {
                type: 'GeometryCollection',
                geometries: geoms
            },
            properties: properties,
            styles: styles
        }];
    }         
})
