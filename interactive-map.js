var StaticMap;
var ZoomableMap;
var StaticCanvasMap;
var ZoomableCanvasMap;

!function() {
    "use strict";
    StaticMap = function(parameters) {
        var settings = jQuery.extend({
                strokeWidth: 1.5,
                height: 200,
                width: $(parameters.element).innerWidth(),
                zoomScaleFactor: 0.9
            }, parameters)
          , features = topojson.feature(settings.topojson,
                                        settings.topojson.objects[parameters.name])

        if (parameters.projection) {
            var dataPath = d3.geo.path().projection(projection = parameters.projection)
        } else {
            var b = d3.geo.bounds(features)
              , projection = d3.geo.mercator()
                                   .scale(1)
                                   .center([(b[1][0] + b[0][0]) / 2,
                                            (b[1][1] + b[0][1]) / 2])
              , dataPath = d3.geo.path().projection(projection)
              , bounds = dataPath.bounds(features)
              , dx = bounds[1][0] - bounds[0][0]
              , dy = bounds[1][1] - bounds[0][1]
              , scale = 0.9 * (settings.width / dx)

            settings.height = dy * settings.width / dx

            projection.scale(scale)
                      .translate([settings.width / 2, settings.height / 2/* + topMargin*/])
        }

        $(this).height(settings.height) //FIXME: Introduce topMargin again

        function init() {
            var svg = d3.select(settings.element).append("svg")
                        .attr("width", settings.width)
                        .attr("height", settings.height/* + topMargin*/)

            svg.append("rect")
                    .attr("class", "map-background")
                    .attr("width", settings.width)
                    .attr("height", settings.height)

            var g = svg.append("g")
                       .attr("class", "map-polygonGroup")
                       .style("stroke-width", settings.strokeWidth + "px")
                       .selectAll("path")
                       .data(features.features)
                       .enter().append("path")
                       .attr("class", "map-polygon")
                       .attr("d", dataPath)
                       .style("fill", settings.fillCallback)

            //Prevent another call to the init method
            this.init = function() {}
        }

        this.init = init
        this.features = function() { return features }
        this.path = function()  { return dataPath }
        this.settings = function() { return settings }
    }

    StaticCanvasMap = function(parameters) {
        topojson.presimplify(parameters.topojson)
        var settings = jQuery.extend({
                strokeWidth: 1.5,
                height: 200,
                width: $(parameters.element).innerWidth(),
                zoomScaleFactor: 0.9
            }, parameters)
          , features = topojson.feature(settings.topojson,
                                        settings.topojson.objects[parameters.name])
          , ratio = 1
          , area = 0
          , clip = d3.geo.clipExtent()
                         .extent([[-settings.width, -settings.height], [settings.width, settings.height]])
          , simplify = d3.geo.transform({
                point: function(x, y, z) {
                    if (z >= area) this.stream.point(x, y)
                }
            })

        if (parameters.projection) {
            var projection = parameters.projection
              , dataPath = d3.geo.path().projection({
                    stream: function(s) {
                        return simplify.stream(clip.stream(projection.stream(s)))
                    }
                })
        } else {
            var b = d3.geo.bounds(features)
              , projection = d3.geo.mercator()
                                   .scale(1)
                                   .center([(b[1][0] + b[0][0]) / 2,
                                            (b[1][1] + b[0][1]) / 2])
              , dataPath = d3.geo.path().projection({
                  stream: function(s) { return simplify.stream(clip.stream(projection.stream(s))) }
              })
              , bounds = dataPath.bounds(features)
              , dx = bounds[1][0] - bounds[0][0]
              , dy = bounds[1][1] - bounds[0][1]
              , scale = 0.9 * (settings.width / dx)

            settings.height = dy * settings.width / dx
            projection.scale(scale)
                      .translate([settings.width / 2, settings.height / 2/* + topMargin*/])
        }
        settings.projection = projection

        $(this).height(settings.height) //FIXME: Introduce topMargin again

        function init() {
            var canvas = d3.select(settings.element)
                           .append("canvas")
              , context = canvas.node().getContext("2d")
              , devicePixelRatio = window.devicePixelRatio || 1
              , backingStoreRatio = context.webkitBackingStorePixelRatio ||
                                    context.mozBackingStorePixelRatio ||
                                    context.msBackingStorePixelRatio ||
                                    context.oBackingStorePixelRatio ||
                                    context.backingStorePixelRatio || 1
            ratio = devicePixelRatio / backingStoreRatio
            area = 1 / settings.projection.scale()

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

            for (var i in features.features) {
                var color = settings.fillCallback(features.features[i], i)
                context.beginPath()
                dataPath(features.features[i])
                context.fillStyle = color
                context.fill()
            }

            context.restore()

            //Prevent another call to the init method
            this.init = function() {}
        }

        this.init = init
        this.features = function() { return features }
        this.path = function()  { return dataPath }
        this.settings = function() { return settings }
        this.context = function() { return context }
        this.ratio = function() { return ratio }
    }

    ZoomableMap = function(parameters) {
        var staticMap = new StaticMap(parameters)
          , settings = $.extend({
                selectCallback: function(d) {}
            }, staticMap.parameters())
          , selected
          , group

        function init() {
            staticMap.init()

            var svg = d3.select(parameters.element + " svg")
            group = svg.select(".map-polygonGroup")

            svg.select(".map-background")
               .on("click", zoomOut)

            svg.selectAll(".map-polygon")
               .on("click", zoomIn)
               .on("mouseover", function(d, i) {
                   d3.select(this).style("stroke", "black")
                })
               .on("mouseout", function(d, i) {
                    d3.select(this).style("stroke", "unset")
               })
        }

        function zoomOut() {
            selected = undefined

            group.transition()
                 .duration(500)
                 .style("stroke-width", settings.strokeWidth + "px")
                 .attr("transform", "")

            settings.selectCallback(undefined)
        }

        function zoomIn(d) {
            if (selected == d || d == undefined) {
                zoomOut()
                return
            }
            selected = d

            var bounds = staticMap.path().bounds(d)
              , dx = bounds[1][0] - bounds[0][0]
              , dy = bounds[1][1] - bounds[0][1]
              , x = (bounds[0][0] + bounds[1][0]) / 2
              , y = (bounds[0][1] + bounds[1][1]) / 2
              , scale = settings.zoomScaleFactor /
                        Math.max(dx / settings.width, dy / settings.height)
              , translate = [settings.width / 2 - scale * x,
                             settings.height / 2 - scale * y/* + topMargin*/]
              , strokeWidthScaled = Math.max(0.01, settings.strokeWidth / scale)

            group.transition()
                 .duration(500)
                 .attr("transform", "translate(" + translate + ")scale(" + scale + ")")
                 .style("stroke-width", strokeWidthScaled + "px")

            settings.selectCallback(selected)
        }

        this.init = init
        this.zoomOut = zoomOut
        this.settings = function() { return settings }
    }

    ZoomableCanvasMap = function(parameters) {
        topojson.presimplify(parameters.topojson)
        var settings = jQuery.extend({
                strokeWidth: 1.5,
                height: 200,
                width: $(parameters.element).innerWidth(),
                zoomScaleFactor: 0.9,
                selectCallback: function(d) {}
            }, parameters)
          , features = topojson.feature(settings.topojson,
                                        settings.topojson.objects[parameters.name])
          , selected = undefined
          , zoom = d3.behavior.zoom()
                              .translate([0, 0])
                              .scale(1)
                              .size([settings.height, settings.width])
                              .on("zoom", paint)
          , ratio = 1
          , area = 0
          , clip = d3.geo.clipExtent()
                         .extent([[-settings.width, -settings.height], [settings.width, settings.height]])
          , simplify = d3.geo.transform({
                point: function(x, y, z) {
                    if (z >= area/* && x >= 0 && y >= 0*/) {
                        //console.log("X: " + x + "Y: " + y)
                        this.stream.point(x, y)
                    }
                }
            })
         , zoomScale = 1
         , zoomTranslate = [0, 0]

        if (parameters.projection) {
            var projection = parameters.projection
              , dataPath = d3.geo.path().projection({
                    stream: function(s) {
                        return simplify.stream(projection.stream(s))
                    }
                })
        } else {
            var b = d3.geo.bounds(features)
              , projection = d3.geo.mercator()
                                   .scale(1)
                                   .center([(b[1][0] + b[0][0]) / 2,
                                            (b[1][1] + b[0][1]) / 2])
              , dataPath = d3.geo.path().projection({
                  stream: function(s) { return simplify.stream(clip.stream(projection.stream(s))) }
              })
              , bounds = dataPath.bounds(features)
              , dx = bounds[1][0] - bounds[0][0]
              , dy = bounds[1][1] - bounds[0][1]
              , scale = 0.9 * (settings.width / dx)

            settings.height = dy * settings.width / dx
            projection.scale(scale)
                      .translate([settings.width / 2, settings.height / 2/* + topMargin*/])
        }
        settings.projection = projection

        $(this).height(settings.height) //FIXME: Introduce topMargin again


        function init() {
           var canvas = d3.select(settings.element)
                          .append("canvas")
                          .on("click", click)
             , context = canvas.node().getContext("2d")
             , devicePixelRatio = window.devicePixelRatio || 1
             , backingStoreRatio = context.webkitBackingStorePixelRatio ||
                                   context.mozBackingStorePixelRatio ||
                                   context.msBackingStorePixelRatio ||
                                   context.oBackingStorePixelRatio ||
                                   context.backingStorePixelRatio || 1
           ratio = devicePixelRatio / backingStoreRatio

           canvas.attr("width", settings.width * ratio)
           canvas.attr("height", settings.height * ratio)
           canvas.style("width", settings.width + "px")
           canvas.style("height", settings.height + "px")
           context.lineJoin = "round"
           context.lineCap = "round"

           dataPath.context(context)

           paint()
        }

        function click() {
            console.log("CLICK " + new Date().getMilliseconds())
            var offset = $(settings.element + " canvas").offset()
              , x = d3.event.clientX - offset.left + window.pageXOffset
              , y = d3.event.clientY - offset.top + window.pageYOffset

            console.log("Create point")
            var point = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": settings.projection.invert([x, y])
                }
            }

            var feats = features.features
              , context = d3.select(settings.element + " canvas")
                            .node().getContext("2d")
            console.log("Start loop " + new Date().getMilliseconds())
            for (var i in feats) {
                if (turf.inside(point, feats[i])) {
                    console.log("Inside: " + feats[i].properties.name + " " + new Date().getMilliseconds())

                    var bounds = dataPath.bounds(feats[i])
                      , dx = bounds[1][0] - bounds[0][0]
                      , dy = bounds[1][1] - bounds[0][1]
                      , bx = (bounds[0][0] + bounds[1][0]) / 2
                      , by = (bounds[0][1] + bounds[1][1]) / 2
                      , scale = settings.zoomScaleFactor *
                                Math.min(settings.width / dx, settings.height / dy)
                      , translate = [-bx + settings.width / scale / 2,
                                     -by + settings.height / scale / 2]
                      , strokeWidthScaled = Math.max(0.01, settings.strokeWidth / scale)
                    console.log("Zoom thang: " + Math.min(dx / settings.width, dy / settings.height))
                    console.log("Zoom: " + scale)
                    console.log("CALCULATED TRANSLATE: " + translate)

                    var origin = [0, 0]

                    /*d3.transition()
                      .duration(300)
                      .ease("exp")
                      .tween("zoom", function() {
                        var i = d3.interpolateArray([0, 0], firstTranslate)
                        return function(t) {
                            console.log(i(t))
                            zoomScale = 1
                            //console.log([tr(t)[0], tr(t)[1]])
                            zoomTranslate = i(t)
                            //zoom.translate([t * t * tr(t)[0], t * t * tr(t)[1]])
                            paint()
                        }
                    })*/

                    d3.transition()
                      .duration(2000)
                      .ease("exp")
                      .tween("zoom", function() {
                        //console.log(scale * ratio)
                        var i = d3.interpolateNumber(1, scale)
                        var tr = d3.interpolateNumber(0, 1)
                        return function(t) {
                            console.log(i(t))
                            zoomScale = i(t)
                            //console.log([tr(t)[0], tr(t)[1]])
                            zoomTranslate = [(i(t) / scale) * (-bx + settings.width / i(t) / 2) - (1 - i(t) / scale) * origin[0],
                                             (i(t) / scale) * (-by + settings.height / i(t) / 2) - (1 - i(t) / scale) * origin[1]]
                                            //[-bx + settings.width / i(t) / 2,
                                            // -by + settings.height / i(t) / 2]
                            //zoom.translate([t * t * tr(t)[0], t * t * tr(t)[1]])
                            paint()
                        }
                    })
                    break
                }
            }
        }

        function paint() {
            //console.log("Paint start: " + new Date().getMilliseconds())
            var feats = features.features
              , context = d3.select(settings.element + " canvas")
                            .node()
                            .getContext("2d")
            area = 1 / settings.projection.scale() / zoomScale

            context.clearRect(0, 0, settings.width * ratio, settings.height * ratio)

            context.save()
            context.scale(ratio * zoomScale, ratio * zoomScale)
            context.translate(zoomTranslate[0], zoomTranslate[1])

            //console.log("translated to: " + zoomTranslate[0] + "," + zoomTranslate[1])
            //console.log("Zoomed to: " + zoomScale)
            //console.log("Paint start feats: " + new Date().getMilliseconds())
            for (var i in feats) {
                context.beginPath()
                dataPath(feats[i])
                context.fillStyle = settings.fillCallback(feats[i], i)
                context.fill()
            }

            context.restore()
            //console.log("Paint end: " + new Date().getMilliseconds())
        }

        function zoomOut() {
        }

        function zoomIn(d) {
        }

        this.init = init
        this.zoomOut = zoomOut
        this.settings = function() { return settings }
    }
}()
