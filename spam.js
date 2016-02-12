var StaticCanvasMap;
var ZoomableCanvasMap;

! function() {
    "use strict";

    // TODO use turf inside as a dependency?
    // Copied from turf.inside
    function inside(pt, polygon) {
        var polys = polygon.geometry.coordinates
        // normalize to multipolygon
        if (polygon.geometry.type === 'Polygon')
            polys = [polys]

        var insidePoly = false
        var i = 0
        while (i < polys.length && !insidePoly) {
            // check if it is in the outer ring first
            if (inRing(pt, polys[i][0])) {
                var inHole = false
                var k = 1
                // check for the point in any of the holes
                while (k < polys[i].length && !inHole) {
                    if (inRing(pt, polys[i][k])) {
                        inHole = true
                    }
                    k++
                }
                if(!inHole)
                    insidePoly = true
            }
            i++
        }
        return insidePoly
    }

    // pt is [x,y] and ring is [[x,y], [x,y],..]
    function inRing (pt, ring) {
        var isInside = false
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var xi = ring[i][0], yi = ring[i][1]
            var xj = ring[j][0], yj = ring[j][1]
            var intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
                (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)
            if (intersect) isInside = !isInside
        }
        return isInside
    }

    function maxBounds(one, two) {
        var bounds = two
        if (one[0][0] < two[0][0])
            bounds[0][0] = one[0][0]
        if (one[0][1] < two[0][1])
            bounds[0][1] = one[0][1]
        if (one[1][0] > two[1][0])
            bounds[1][0] = one[1][0]
        if (one[1][1] > two[1][1])
            bounds[1][1] = one[1][1]
        return bounds
    }

    function CanvasMap(parameters) {
        var settings = jQuery.extend({
                height: 200,
                width: $(parameters.element).innerWidth(),
                ratio: 1,
                area: 0,
                scale: 1,
                translate: [0, 0],
                background: null
            }, parameters),
            simplify = d3.geo.transform({
                point: function(x, y, z) {
                    if (z >= settings.area) this.stream.point(x, y)
                }
            }),
            canvas = null,
            context = null,
            map = this

        if (parameters.projection) {
            var dataPath = d3.geo.path().projection({
                    stream: function(s) {
                        return simplify.stream(settings.projection.stream(s))
                    }
                })
        } else {
            var b = [[Number.MAX_VALUE, Number.MAX_VALUE],
                     [Number.MIN_VALUE, Number.MIN_VALUE]]
            for (var i in settings.data) {
                var featureBounds = d3.geo.bounds(settings.data[i].features)
                b = maxBounds(featureBounds, b)
            }
            settings.projection = d3.geo.mercator()
                .scale(1)
                .center([(b[1][0] + b[0][0]) / 2, (b[1][1] + b[0][1]) / 2]),
                dataPath = d3.geo.path().projection({
                    stream: function(s) {
                        return simplify.stream(settings.projection.stream(s))
                    }
                })
            b = [[Number.MAX_VALUE, Number.MAX_VALUE],
                 [Number.MIN_VALUE, Number.MIN_VALUE]]
            for (var i in settings.data) {
                featureBounds = dataPath.bounds(settings.data[i].features)
                b = maxBounds(featureBounds, b)
            }

            var dx = b[1][0] - b[0][0],
                dy = b[1][1] - b[0][1],
                scale = 0.9 * (settings.width / dx)

            settings.height = dy * settings.width / dx
            settings.projection.scale(scale)
                .translate([settings.width / 2, settings.height / 2])
        }
        $(this).height(settings.height)

        function init() {
            canvas = d3.select(settings.element)
                .append("canvas")
                .on("click", click)
                .on("mousemove", hover)
            context = canvas.node().getContext("2d")

            var devicePixelRatio = window.devicePixelRatio || 1,
                backingStoreRatio = context.webkitBackingStorePixelRatio ||
                context.mozBackingStorePixelRatio ||
                context.msBackingStorePixelRatio ||
                context.oBackingStorePixelRatio ||
                context.backingStorePixelRatio || 1
            settings.ratio = devicePixelRatio / backingStoreRatio
            settings.area = 1 / settings.projection.scale() / settings.ratio

            canvas.attr("width", settings.width * settings.ratio)
            canvas.attr("height", settings.height * settings.ratio)
            canvas.style("width", settings.width + "px")
            canvas.style("height", settings.height + "px")
            context.lineJoin = "round"
            context.lineCap = "round"

            dataPath.context(context)

            context.clearRect(0, 0, settings.width * settings.ratio, settings.height * settings.ratio)

            context.save()

            context.scale(settings.ratio, settings.ratio)

            // TODO move rtree part out?
            for (var i in settings.data) {
                var element = settings.data[i]
                element.lookupTree = rbush(4)
                element.prepaint(context)
                for (var j in element.features.features) {
                    var bounds = dataPath.bounds(element.features.features[j])
                    element.lookupTree.insert([
                        bounds[0][0].toFixed(0),
                        bounds[0][1].toFixed(0),
                        bounds[1][0].toFixed(0),
                        bounds[1][1].toFixed(0),
                        element.features.features[j]
                    ])
                    context.beginPath()
                    dataPath(element.features.features[j])
                    element.paintfeature(context, element.features.features[j])
                }
                element.postpaint(context)
            }

            settings.background = new Image()
            settings.background.onload = function() {
                for (var i in settings.data) {
                    var element = settings.data[i]

                    if (element.dynamicpaint)
                        element.dynamicpaint(context, dataPath, null)
                }

                context.restore()
            }
            settings.background.src = canvas.node().toDataURL()

            //Prevent another call to the init method
            this.init = function() {}
        }


        function paint() {
            // TODO needs a lot more fixes for scale/translate and stuff
            context.save()
            context.scale(settings.ratio, settings.ratio)
            context.clearRect(0, 0, settings.width * settings.ratio, settings.height * settings.ratio)
            context.drawImage(settings.background, 0, 0, settings.width, settings.height)

            for (var i in settings.data) {
                var element = settings.data[i]
                if (element.dynamicpaint)
                    element.dynamicpaint(context, dataPath, element.hoverElement)
            }

            context.restore()
        }

        function translatePoint(point) {
            return [point[0] / settings.scale - settings.translate[0],
                point[1] / settings.scale - settings.translate[1]
            ]
        }

        function click() {
            var point = translatePoint(d3.mouse(this))

            for (var i in settings.data) {
                var element = settings.data[i]
                if (!element.click)
                    continue

                var lookup = element.lookupTree.search([point[0], point[1], point[0], point[1]])
                for (var j in lookup) {
                    var feature = lookup[j][4]
                    if (inside(settings.projection.invert(point), feature))
                        element.click(map, feature)
                }
            }
        }

        function hover() {
            var point = translatePoint(d3.mouse(this)),
                repaint = false

            for (var i in settings.data) {
                var element = settings.data[i]
                var lookup = element.lookupTree.search([point[0], point[1], point[0], point[1]])
                var isInside = false
                for (var j in lookup) {
                    var feature = lookup[j][4]
                    if (inside(settings.projection.invert(point), feature)) {
                        isInside = true
                        if (element.hoverElement == feature) // FIXME is this mutability hack a good thang?
                            continue
                        element.hoverElement = feature
                        repaint = true
                    }
                }
                if (!isInside && element.hoverElement) {
                    element.hoverElement = false
                    repaint = true
                }
            }
            if (repaint)
                paint()
        }

        this.init = init
        this.paint = paint
    }

    StaticCanvasMap = function(paramaters) {
        var map = new CanvasMap(paramaters)

        this.init = function() {
            map.init()
        }
        this.paint = function() {
            map.paint()
        }
    }

    ZoomableCanvasMap = function(parameters) {
        // TODO define api for zoom polygons?
        // handle clicks, zoom into polygon
        // FIXME how to handle zoom outs?
        var map = new CanvasMap(paramaters)

        this.init = function() {
            map.init()
        }
        this.paint = function() {
            map.paint()
        }
    }

    var StaticTryCanvasMap = function(parameters) {
        var settings = jQuery.extend({
                strokeWidth: 1.5,
                height: 200,
                width: $(parameters.element).innerWidth(),
                zoomScaleFactor: 0.9
            }, parameters),
            ratio = 1,
            area = 0,
            simplify = d3.geo.transform({
                point: function(x, y, z) {
                    if (z >= area) this.stream.point(x, y)
                }
            }),
            canvas = null,
            context = null,
            staticMap = null

        if (parameters.projection) {
            var projection = parameters.projection,
                dataPath = d3.geo.path().projection({
                    stream: function(s) {
                        return simplify.stream(projection.stream(s))
                    }
                })
        } else {
            var b = [
                [Number.MAX_VALUE, Number.MAX_VALUE],
                [Number.MIN_VALUE, Number.MIN_VALUE]
            ]
            for (var i in settings.data) {
                var featureBounds = d3.geo.bounds(settings.data[i].features)
                b = maxBounds(featureBounds, b)
            }
            var projection = d3.geo.mercator()
                .scale(1)
                .center([(b[1][0] + b[0][0]) / 2, (b[1][1] + b[0][1]) / 2]),
                dataPath = d3.geo.path().projection({
                    stream: function(s) {
                        return simplify.stream(projection.stream(s))
                    }
                }),
                bounds = [
                    [Number.MAX_VALUE, Number.MAX_VALUE],
                    [Number.MIN_VALUE, Number.MIN_VALUE]
                ]
            for (var i in settings.data) {
                featureBounds = dataPath.bounds(settings.data[i].features)
                bounds = maxBounds(featureBounds, bounds)
            }

            var dx = bounds[1][0] - bounds[0][0],
                dy = bounds[1][1] - bounds[0][1],
                scale = 0.9 * (settings.width / dx)

            settings.height = dy * settings.width / dx
            projection.scale(scale)
                .translate([settings.width / 2, settings.height / 2])
        }
        settings.projection = projection

        $(this).height(settings.height)

        function init() {
            canvas = d3.select(settings.element)
                .append("canvas")
                .on("click", click)
                .on("mousemove", hover)
            context = canvas.node().getContext("2d")

            var devicePixelRatio = window.devicePixelRatio || 1,
                backingStoreRatio = context.webkitBackingStorePixelRatio ||
                context.mozBackingStorePixelRatio ||
                context.msBackingStorePixelRatio ||
                context.oBackingStorePixelRatio ||
                context.backingStorePixelRatio || 1
            ratio = devicePixelRatio / backingStoreRatio
            area = 1 / settings.projection.scale() / ratio

            canvas.attr("width", settings.width * ratio)
            canvas.attr("height", settings.height * ratio)
            canvas.style("width", settings.width + "px")
            canvas.style("height", settings.height + "px")
            context.lineJoin = "round"
            context.lineCap = "round"

            dataPath.context(context)

            context.clearRect(0, 0, settings.width * ratio, settings.height * ratio)

            context.save()

            context.scale(ratio, ratio)

            // TODO paint to picture + hover
            // TODO click

            for (var i in settings.data) {
                var element = settings.data[i]
                element.lookupTree = rbush(4)
                element.prepaint(context)
                for (var j in element.features.features) {
                    var bounds = dataPath.bounds(element.features.features[j])
                    element.lookupTree.insert([
                        bounds[0][0].toFixed(0),
                        bounds[0][1].toFixed(0),
                        bounds[1][0].toFixed(0),
                        bounds[1][1].toFixed(0),
                        element.features.features[j]
                    ])
                    context.beginPath()
                    dataPath(element.features.features[j])
                    element.paintfeature(context, element.features.features[j])
                }
                element.postpaint(context)
            }

            // TODO save picture
            staticMap = new Image()
            staticMap.onload = function() {
                for (var i in settings.data) {
                    var element = settings.data[i]

                    if (element.dynamicpaint)
                        element.dynamicpaint(context, dataPath, null)
                }
            }
            staticMap.src = canvas.node().toDataURL()

            context.restore()

            //Prevent another call to the init method
            this.init = function() {}
        }

        function paint() {
            context.save()
            context.scale(ratio, ratio)
            context.clearRect(0, 0, settings.width * ratio, settings.height * ratio)
            context.drawImage(staticMap, 0, 0, settings.width, settings.height)

            for (var i in settings.data) {
                var element = settings.data[i]
                if (element.dynamicpaint)
                    element.dynamicpaint(context, dataPath, element.hoverElement)
            }

            context.restore()
        }

        /*function translatePoint(point) {
            return [point[0] / zoomScale - zoomTranslate[0],
                point[1] / zoomScale - zoomTranslate[1]
            ]
        }*/

        function click() {
            var point = /*translatePoint(*/d3.mouse(this)/*)*/

            for (var i in settings.data) {
                var element = settings.data[i]
                if (!element.click)
                    continue

                var lookup = element.lookupTree.search([point[0], point[1], point[0], point[1]])
                for (var j in lookup) {
                    var feature = lookup[j][4]
                    if (inside(settings.projection.invert(point), feature))
                        element.click(feature)
                }
            }
        }

        function hover() {
            var point = /*translatePoint(*/d3.mouse(this)/*)*/,
                repaint = false

            for (var i in settings.data) {
                var element = settings.data[i]
                var lookup = element.lookupTree.search([point[0], point[1], point[0], point[1]])
                var isInside = false
                for (var j in lookup) {
                    var feature = lookup[j][4]
                    if (inside(settings.projection.invert(point), feature)) {
                        isInside = true
                        if (element.hoverElement == feature) // FIXME is this mutability hack a good thang?
                            continue
                        element.hoverElement = feature
                        repaint = true
                    }
                }
                if (!isInside && element.hoverElement) {
                    element.hoverElement = false
                    repaint = true
                }
            }
            if (repaint)
                paint()
        }

        this.init = init
        this.features = function() {
            return features
        }
        this.path = function() {
            return dataPath
        }
        this.settings = function() {
            return settings
        }
        this.context = function() {
            return context
        }
        this.ratio = function() {
            return ratio
        }
    }
}()
