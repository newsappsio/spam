# spam
spam.js is a small library to create modern [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) maps with [D3](https://github.com/mbostock/d3). It supports static and zoomable maps with automatic centering.

It doesn't tie you to a custom framework, so you're still in charge of painting everything. For making that easy it divides the process into several stages (`prepaint`, `paintfeature`, `postpaint`, `dynamicpaint`).

The library supports custom projections, `d3.geo` path generators and multiple features in the same map.

## Getting started
spam.js depends on [D3](https://github.com/mbostock/d3), [rbush](https://github.com/mourner/rbush) and [TopoJSON](https://github.com/mbostock/topojson).

Due to a bug on D3 and TopoJSON you'll need to use our forks. Grab them [here](https://github.com/lukasappelhans/d3) and [here](https://github.com/lukasappelhans/topojson). We are expecting a PR soon.

Here's the most basic map you can do:

```javascript
d3.json("map.json", function(error, d) {
    topojson.presimplify(d)

    var map = new StaticCanvasMap({
        element: "body",
        data: [{
                features: topojson.feature(d, d.objects["map"]),
                paintfeature: function(parameters, d) {
                    parameters.context.stroke()
                }
            }
        ]
    })
    map.init()
})
```

And that's it! A simple, static map in just a few lines of code! It will be automagically projected and centered in your container, nothing else needed.

## Examples
Explore some of the maps we already did with spam:
- [Basic map](http://bl.ocks.org/martgnz/c48aa019de720fcd86030d3b07990d8d)
- [Static choropleth with tooltip, legend and graticule](http://bl.ocks.org/martgnz/1c0fa3985d0a7b51437cdfd326cc2fda)
- [Zoomable choropleth with multiple features and tooltip](http://bl.ocks.org/martgnz/a61c2da0e45a108c857e)
- [Zoomable choropleth with multiple features, tooltip and legend](http://bl.ocks.org/martgnz/a61c2da0e45a108c857e)
- [Custom projection I + graticule](http://bl.ocks.org/martgnz/d8bc3d6c29e712e3255f095671a51967)
- [Custom projection II + graticule](http://bl.ocks.org/martgnz/cce95512ca18c226b4cc)
- [Static map with custom projection and labels](http://bl.ocks.org/martgnz/e5c0387a5bb675b061a2c0a9f573f86a)
- [Static data visualization with custom projection](http://bl.ocks.org/martgnz/9023a67f080cca8b31ef5d6b1dcf4637)

### API
spam.js exports two classes: StaticCanvasMap and ZoomableCanvasMap. The only difference between them is that the latter provides a *zoom*-function which takes a feature as parameter.

#### Constructor
Both constructors take a parameters object, while both of them accept the same members.
Mandatory elements:
*element*: This can be any term that works with d3.select() and is used to lookup the element that is used as the parent of the DOM-elements the spam.js-code will create.

*data*: This is an array of objects that define what will be rendered by spam.js. spam.js can render multiple datasets, the first element in the array gets painted first. The only mandatory property is *features* which takes a FeatureCollection. (link to topojson?)
TODO put the definition of the data before the spam api up there.

Optional elements: *prepaint*, *paintfeature*, *postpaint*, *dynamicpaint*, *click*
- *width*
- *height*
