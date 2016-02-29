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

        var elements = []
        for (var j in element.features.features) {
            var bounds = dataPath.bounds(element.features.features[j])
            elements.push([
                bounds[0][0].toFixed(0),
                bounds[0][1].toFixed(0),
                bounds[1][0].toFixed(0),
                bounds[1][1].toFixed(0),
                element.features.features[j]
            ])
        }
        element.lookupTree.insert(elements)
    }

    function paintFeature(element, feature, parameters) {
        parameters.context.beginPath()
        parameters.path(feature)
        element.paintfeature(parameters, feature)
    }

    function paintBackgroundElement(element, parameters) {
        element.prepaint(parameters)
        var lookup = element.lookupTree.search([
            parameters.translate[0],
            parameters.translate[1],
            parameters.width / parameters.scale - parameters.translate[0],
            parameters.height / parameters.scale - parameters.translate[1]
        ])
        for (var j in lookup) {
            var feature = lookup[j][4]
            paintFeature(element, feature, parameters)
        }
        element.postpaint(parameters)
    }

    function PartialPainter(data, parameters) {
        var index = 0,
            j = 0,
            element = null,
            currentLookup = []

        this.hasNext = function() {
            return index <= data.length && j < currentLookup.length
        }
        this.renderNext = function() {
            if (index >= data.length && j >= currentLookup.length)
                return
            var start = performance.now()
            if (!element || j >= currentLookup.length) {
                element = data[index]

                element.prepaint(parameters)
                currentLookup = element.lookupTree.search([
                    - parameters.translate[0],
                    - parameters.translate[1],
                    parameters.width / parameters.scale - parameters.translate[0],
                    parameters.height / parameters.scale - parameters.translate[1]
                ])
                j = 0
                ++index
            }
            for (; j != currentLookup.length; ++j) {
                var feature = currentLookup[j][4]
                paintFeature(element, feature, parameters)
                if ((performance.now() - start) > 10)
                    break
            }
            if (j == currentLookup.length) {
                element.postpaint(parameters)
            }
        }
        this.finish = function() {
            if (index >= data.length && j >= currentLookup.length)
                return
            for (; index != data.length; ++index) {
                if (j >= currentLookup.length) {
                    element = data[index]

                    element.prepaint(parameters)
                    currentLookup = element.lookupTree.search([
                        - parameters.translate[0],
                        - parameters.translate[1],
                        parameters.width / parameters.scale - parameters.translate[0],
                        parameters.height / parameters.scale - parameters.translate[1]
                    ])
                    j = 0
                }
                for (; j != currentLookup.length; ++j) {
                    var feature = currentLookup[j][4]
                    paintFeature(element, feature, parameters)
                }
                element.postpaint(parameters)
            }
            index = 0
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
            var projectionStart = performance.now()
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

            var projectionEnd = performance.now()
            console.log("Projection takes " + (projectionEnd - projectionStart))
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
            var rtreeStart = performance.now()
            for (var i in settings.data) {
                createRTree(settings.data[i], dataPath)
            }
            var rtreeEnd = performance.now()
            console.log("Rtree building takes " + (rtreeEnd - rtreeStart))

            settings.background = new Image()
            settings.backgroundScale = settings.scale
            settings.backgroundTranslate = settings.translate
            var callback = function() {
                var parameters = {
                    path: dataPath,
                    context: context,
                    scale: settings.scale,
                    translate: settings.translate,
                    width: settings.width,
                    height: settings.height,
                    map: settings.map
                }
                for (var i in settings.data) {
                    var element = settings.data[i]

                    if (element.dynamicpaint)
                        element.dynamicpaint(parameters, null)
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

        function saveBackground(saveCanvas, saveDataPath, background, callback) {
            var parameters = {
                path: saveDataPath,
                context: saveDataPath.context(),
                scale: settings.scale,
                translate: settings.translate,
                width: settings.width,
                height: settings.height,
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
                translatedMax = translatePoint([settings.width * settings.ratio, settings.height * settings.ratio])

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
                var isInside = false
                for (var j in lookup) {
                    var feature = lookup[j][4]
                    if (inside(settings.projection.invert(point), feature)) {
                        element.click(settings.map, feature)
                        isInside = true
                    }
                }
                isInside || element.click(settings.map, null)
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

    var epsilon = 0.0001
    function nearEqual(a, b) {
        return Math.abs(a - b) < epsilon
    }

    function ImageCache() {
        var cache = []
        this.addImage = function(parameters) {
            cache.push(parameters)
        }

        this.getImage = function(parameters) {
            for (var i in cache) {
                var element = cache[i]
                if (nearEqual(element.scale, parameters.scale) &&
                    nearEqual(element.translate[0], parameters.translate[0]) &&
                    nearEqual(element.translate[1], parameters.translate[1]))
                    return element
            }
            return null
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
            }),
            imageCache = new ImageCache()

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
            canvas.style("display", "none")
            context.lineJoin = "round"
            context.lineCap = "round"

            dataPath.context(context)
        }
        this.paint = function() {
            map.paint()
        }
        function scaleZoom(scale, translate) {
            console.log("Scale zoom")
            console.log(scale)
            console.log(translate)
            area = 1 / settings.projection.scale() / scale / settings.ratio

            context.save()
            context.scale(scale * settings.ratio, scale * settings.ratio)
            context.translate(translate[0], translate[1])
            context.clearRect(translate[0], translate[1], settings.width * settings.ratio, settings.height * settings.ratio)
            var parameters = {
                path: dataPath,
                context: context,
                scale: scale,
                translate: translate,
                width: settings.width,
                height: settings.height,
                map: settings.map
            }

            var image = imageCache.getImage({
                scale: scale,
                translate: translate
            })
            if (!image) {
                var background = new Image()
                var partialPainter = new PartialPainter(settings.data, parameters)
            } else {
                var background = image.image
            }
            // FIXME when zooming we sometimes have missing parts of the bg, fix that?
            // Prob add stuff to the bg? (Draw the image, then paint some polygon parts on the left)
            // Or have a bigger area painted on the pic?
            // Probably get the closed pic to the needed scale + translate that fits? (e.g. 1/[0, 0] sometimes?)
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
                        if (!image)
                            partialPainter.renderNext()
                    }
                })
                .each("end", function() {
                    settings.scale = scale
                    settings.translate = translate

                    if (!image) {
                        partialPainter.finish()
                        background.onload = function() {
                            context.restore()
                            imageCache.addImage({
                                image: background,
                                scale: scale,
                                translate: translate
                            })
                            settings.background = background
                            settings.backgroundScale = settings.scale
                            settings.backgroundTranslate = settings.translate
                            map.paint()
                        }
                        // TODO there is a function to get the image data from the context, is that faster?
                        background.src = canvas.node().toDataURL()
                    } else {
                        context.restore()
                        settings.background = background
                        settings.backgroundScale = settings.scale
                        settings.backgroundTranslate = settings.translate
                        map.paint()
                    }
                })
        }
        this.zoom = function(d) {
            if (!d) {
                scaleZoom(1, [0, 0])
                return
            }
            var bounds = dataPath.bounds(d),
                dx = bounds[1][0] - bounds[0][0],
                dy = bounds[1][1] - bounds[0][1],
                bx = (bounds[0][0] + bounds[1][0]) / 2,
                by = (bounds[0][1] + bounds[1][1]) / 2,
                scale = 0.1 * // TODO bring back zoomScaleFactor?
                    Math.min(settings.width / dx, settings.height / dy),
                translate = [-bx + settings.width / scale / 2,
                             -by + settings.height / scale / 2]

            scaleZoom(scale, translate)
        }
    }
}()
