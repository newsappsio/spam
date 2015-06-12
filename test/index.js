$(document).ready(function() {
    d3.json("provincias.json", function(d) {
        /*var mapWidth = $(".js-test").innerWidth(),
            mapHeight = 600,
            scale = 2700;
        var projection = d3.geo.conicConformalSpain()
                               .translate([mapWidth / 2 + 40, mapHeight / 2 - 40])
                               .scale(scale);*/
        var parameters = {
            element: ".js-test",
            topojson: d,
            name: "provincias",
            zoomScaleFactor: 0.2,
            fillCallback: function(d, i) {
                var c = i % 4;
                if (c == 0)
                    return "blue"
                else if (c == 1)
                    return "red"
                else if (c == 2)
                    return "yellow"
                else
                    return "green"
            }
            //projection: projection,
            //height: mapHeight
        }
        var map = new ZoomableMap(parameters)
        console.log(map)
        map.init()
        console.log(map)
    })

})
