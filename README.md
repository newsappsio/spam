# spam
spam.js is a small library to create modern [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) maps with [D3](https://github.com/mbostock/d3). It makes it easy to create static or zoomable maps with automatic centering and retina resolution. Custom projections, `d3.geo` path generators and multiple map features are also supported.

## Introduction
When using spam.js you are still in charge of painting everything. However it creates the canvas boilerplate and tries to handle as much as possible without putting constraints on the user. In order to improve performance, spam.js uses two painting phases. The 'static' layer is created once (for every zoom level) and should contain the majority of operations. After these operations complete, the canvas is saved into a picture.
Now every time the canvas needs a repaint (e.g. for hover effects), spam.js enters the 'dynamic' painting phase. Here we provide the option to paint dynamic content, while painting the 'static' image in the background.

In order to get the most out of spam.js, we encourage you to think about which parts of your map are static and dynamic beforehand and then use the appropriate callbacks. The more code runs in the 'static' functions, the faster spam.js will become.

## Getting started
spam.js depends on [D3](https://github.com/mbostock/d3), [rbush](https://github.com/mourner/rbush) and [TopoJSON](https://github.com/mbostock/topojson).

Due to bugs in D3 and TopoJSON you'll need to use our forks. Grab them [here](https://github.com/lukasappelhans/d3) and [here](https://github.com/lukasappelhans/topojson). We are expecting a PR soon.

Clone the repository (or download the zip) and include `spam.js` after D3, TopoJSON and rbush in your website.

````html
<script src="d3.min.js"></script>
<script src="topojson.min.js"></script>
<script src="rbush.min.js"></script>
<script src="spam.js"></script>
```

Here's the most basic map you can do:

```javascript
d3.json("map.json", function(error, d) {
    topojson.presimplify(d)

    var map = new StaticCanvasMap({
        element: "body",
        data: [
            {
                features: topojson.feature(d, d.objects["map"]),
                static: {
                    paintfeature: function(parameters, d) {
                        parameters.context.stroke()
                    }
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
- [Static map](http://bl.ocks.org/martgnz/c48aa019de720fcd86030d3b07990d8d)
- [Zoomable map](http://bl.ocks.org/martgnz/fa8187c716c8a6d788eab7d51095b419)

---
- [Static map with labels](http://bl.ocks.org/martgnz/e5c0387a5bb675b061a2c0a9f573f86a)
- [Static choropleth with tooltip, legend and graticule](http://bl.ocks.org/martgnz/1c0fa3985d0a7b51437cdfd326cc2fda)
- [Static data visualization with custom projection](http://bl.ocks.org/martgnz/9023a67f080cca8b31ef5d6b1dcf4637)
- [Zoomable choropleth with multiple features and tooltip](http://bl.ocks.org/martgnz/a61c2da0e45a108c857e)
- [Custom projection I + graticule](http://bl.ocks.org/martgnz/d8bc3d6c29e712e3255f095671a51967)
- [Custom projection II + graticule](http://bl.ocks.org/martgnz/cce95512ca18c226b4cc)

## License
MIT © [newsapps.io](https://github.com/newsappsio).
