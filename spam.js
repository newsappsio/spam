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

    function createRTree(element, dataPath) {
        element.lookupTree = rbush(4)
        for (var j in element.features.features) {
            var bounds = dataPath.bounds(element.features.features[j])
            // FIXME does bulk insert work faster?
            element.lookupTree.insert([
                bounds[0][0].toFixed(0),
                bounds[0][1].toFixed(0),
                bounds[1][0].toFixed(0),
                bounds[1][1].toFixed(0),
                element.features.features[j]
            ])
        }
    }

    function CanvasMap(parameters) {
        var settings = jQuery.extend({
                height: 200,
                width: $(parameters.element).innerWidth(),
                ratio: 1,
                area: 0,
                scale: 1,
                translate: [0, 0],
                background: null,
                backgroundScale: 1,
                backgroundTranslate: [0, 0],
                map: this
            }, parameters),
            simplify = d3.geo.transform({
                point: function(x, y, z) {
                    if (z >= settings.area) {
                        this.stream.point(x, y)
                    }
                }
            }),
            canvas = null,
            context = null

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
                .center([(b[1][0] + b[0][0]) / 2, (b[1][1] + b[0][1]) / 2])
            var dataPath = d3.geo.path().projection({
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

            settings.height = Math.ceil(dy * settings.width / dx)
            settings.projection.scale(scale)
                .translate([settings.width / 2, settings.height / 2])
        }
        $(this).height(settings.height)

        // TODO make this code more playful

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
                createRTree(settings.data[i], dataPath)
            }

            settings.background = new Image()
            settings.backgroundScale = settings.scale
            settings.backgroundTranslate = settings.translate
            var callback = function() {
                for (var i in settings.data) {
                    var element = settings.data[i]

                    if (element.dynamicpaint)
                        element.dynamicpaint(context, dataPath, null)
                }

                context.restore()
            }
            saveBackground(canvas, dataPath, settings.background, callback)
            context.restore()

            //Prevent another call to the init method
            this.init = function() {}
        }

        // TODO later when saving while zooming
        // We need a duplicated datapath with a different area to do the painting, as well as a different canvas
        // This should be created in another class
        // Then we can use the paintElement class, to paint stuff at each zoom step :)
        // With the hope that it will be sorta smooth
        // need to test on mobile as well
        function paintBackgroundElement(element, parameters) {
            element.prepaint(parameters)
            for (var j in element.features.features) {
                var bounds = parameters.path.bounds(element.features.features[j])

                parameters.context.beginPath()
                parameters.path(element.features.features[j])
                element.paintfeature(parameters, element.features.features[j])
            }
            element.postpaint(parameters)
        }

        function saveBackground(saveCanvas, saveDataPath, background, callback) {
            var parameters = {
                path: saveDataPath,
                context: saveDataPath.context(),
                scale: settings.scale,
                translate: settings.translate,
                map: settings.map
            }
            for (var i in settings.data) {
                var element = settings.data[i]
                paintBackgroundElement(element, parameters)
            }

            background.onload = callback
            background.src = saveCanvas.node().toDataURL()
        }

        function paint() {
            context.save()
            context.scale(settings.scale * settings.ratio, settings.scale * settings.ratio)
            context.translate(settings.translate[0], settings.translate[1])

            var imageTranslate = [(settings.backgroundTranslate[0] - settings.translate[0])
                    * settings.backgroundScale * settings.ratio,
                (settings.backgroundTranslate[1] - settings.translate[1])
                    * settings.backgroundScale * settings.ratio],
                translatedZero = translatePoint([0, 0]),
                translatedMax = translatePoint([settings.width, settings.height])

            context.clearRect(translatedZero[0], translatedZero[1],
                translatedMax[0], translatedMax[1])

            /*console.log(settings.translate)
            console.log("Image dimensions are " + settings.background.width + " x " + settings.background.height)
            console.log("We are showing")*/
            var imageWidth = Math.floor((translatedMax[0] - translatedZero[0]) * settings.backgroundScale * settings.ratio)
            var imageHeight = Math.floor((translatedMax[1] - translatedZero[1]) * settings.backgroundScale * settings.ratio)
            var widthFactor = 1
            var heightFactor = 1

            if (imageWidth > settings.width * settings.ratio) {
                widthFactor = settings.width * settings.ratio / imageWidth
                imageWidth = settings.width * settings.ratio
            }

            if (imageHeight > settings.height * settings.ratio) {
                heightFactor = settings.height * settings.ratio / imageHeight
                imageHeight = settings.height * settings.ratio
            }

            //console.log("X: " + imageTranslate[0] + " Y: " + (imageTranslate[1]) + " width: " + imageWidth + " height " + imageHeight)
            context.drawImage(settings.background,
                imageTranslate[0], imageTranslate[1],
                imageWidth,
                imageHeight,
                translatedZero[0], translatedZero[1],
                (translatedMax[0] - translatedZero[0]) * widthFactor,
                (translatedMax[1] - translatedZero[1]) * heightFactor)

            // FIXME this needs a way for the callback to use the lookupTree?
            var parameters = {
                path: dataPath,
                context: dataPath.context(),
                scale: settings.scale,
                translate: settings.translate,
                map: settings.map
            }
            settings.area = 1 / settings.projection.scale() / settings.scale / settings.ratio
            for (var i in settings.data) {
                var element = settings.data[i]
                if (element.dynamicpaint)
                    element.dynamicpaint(parameters, element.hoverElement)
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
                        element.click(settings.map, feature)
                }
            }
        }

        function hover() {
            var point = translatePoint(d3.mouse(this)),
                repaint = false

            for (var i in settings.data) {
                var element = settings.data[i]
                var lookup = element.lookupTree.search([point[0], point[1], point[0], point[1]])
                for (var j in lookup) {
                    var feature = lookup[j][4]
                    if (inside(settings.projection.invert(point), feature)) {
                        if (element.hoverElement == feature) // FIXME is this mutability hack a good thang?
                            break
                        element.hoverElement = feature
                        repaint = true
                        break
                    } else if (element.hoverElement) {
                        element.hoverElement = false
                        repaint = true
                    }
                }
            }
            repaint && paint()
        }

        this.init = init
        this.paint = paint
        this.settings = function() {
            return settings
        }
        this.saveBackground = saveBackground
    }

    StaticCanvasMap = function(parameters) {
        var map = new CanvasMap(parameters)

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
        var map = new CanvasMap(parameters),
            simplify = d3.geo.transform({
                point: function(x, y, z) {
                    if (z >= area) this.stream.point(x, y)
                }
            }),
            area = 0,
            canvas = null,
            context = null,
            settings = map.settings(),
            dataPath = d3.geo.path().projection({
                stream: function(s) {
                    return simplify.stream(settings.projection.stream(s))
                }
            })

        settings.map = this

        this.init = function() {
            map.init()

            canvas = d3.select(settings.element)
                .append("canvas")
            context = canvas.node().getContext("2d")
            area = 1 / settings.projection.scale() / settings.ratio

            canvas.attr("width", settings.width * settings.ratio)
            canvas.attr("height", settings.height * settings.ratio)
            canvas.style("width", settings.width + "px")
            canvas.style("height", settings.height + "px")
            context.lineJoin = "round"
            context.lineCap = "round"

            dataPath.context(context)
        }
        this.paint = function() {
            map.paint()
        }
        this.zoom = function(d) {
            console.log("ZOOM")
            var bounds = dataPath.bounds(d),
                dx = bounds[1][0] - bounds[0][0],
                dy = bounds[1][1] - bounds[0][1],
                bx = (bounds[0][0] + bounds[1][0]) / 2,
                by = (bounds[0][1] + bounds[1][1]) / 2,
                scale = 0.1 * // TODO bring back zoomScaleFactor?
                    Math.min(settings.width / dx, settings.height / dy),
                translate = [-bx + settings.width / scale / 2,
                             -by + settings.height / scale / 2]

            console.log(bx)
            console.log(by)
            // FIXME when zooming we sometimes have missing parts of the bg, fix that?
            // Prob add stuff to the bg? (Draw the image, then paint some polygon parts on the left)
            // Or have a bigger area painted on the pic?
            d3.transition()
                .duration(300)
                .ease("linear")
                .tween("zoom", function() {
                    var i = d3.interpolateNumber(settings.scale, scale)
                    var interpolatedTranslate = d3.interpolateArray(settings.translate, translate)
                    var otherOldTranslate = settings.translate
                    area = 1 / scale / settings.projection.scale() / 4
                    return function(t) {
                        settings.scale = i(t)
                        var iT = interpolatedTranslate(t)
                        settings.translate = [otherOldTranslate[0] + (iT[0] - otherOldTranslate[0]) * scale / i(t),
                            otherOldTranslate[1] + (iT[1] - otherOldTranslate[1]) * scale / i(t)
                        ]
                        map.paint()
                    }
                })
                .each("end", function() {
                    settings.scale = scale
                    settings.translate = translate
                    area = 1 / settings.projection.scale() / settings.scale / settings.ratio

                    // We have weird artefacts sometimes
                    context.save()
                    context.scale(settings.scale * settings.ratio, settings.scale * settings.ratio)
                    context.translate(settings.translate[0], settings.translate[1])
                    context.clearRect(0, 0, settings.width, settings.height)
                    console.log("SAVE BG")
                    var background = new Image()
                    map.saveBackground(canvas, dataPath, background, function() {
                        console.log("PAINT")
                        context.restore()
                        settings.background = background
                        settings.backgroundScale = settings.scale
                        settings.backgroundTranslate = settings.translate
                        map.paint()
                    })
                })
        }
    }
}()
