# spam
spam.js is a small library to create modern [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) maps with [D3](https://github.com/mbostock/d3). It supports static and zoomable maps with automatic centering.

It doesn't tie you to a custom framework, so you're still in charge of painting the map. For making that easy it divides the process into several stages (`prepaint`, `paintfeature`, `postpaint`, `dynamicpaint`).

The library supports custom projections, `d3.geo` path generators and multiple features in the same map.

## Getting started
spam.js depends on D3, rbush and topojson.

TODO describe basic motivation
describe that we depend on d3, rbush and topojson
describe about way of painting while zooming into picture, prepaint/paintfeature/postpaint, dynamic paint

## Examples
Explore some of the maps we already did with spam:
- [Basic map](http://bl.ocks.org/martgnz/bf11c0d07cc5d667f25d749dd4d275ea)
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
