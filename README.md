=== spam.js | maps in javascript ===
TODO describe basic motivation
describe that we depend on d3, rbush and topojson
describe about way of painting while zooming into picture, prepaint/paintfeature/postpaint, dynamic paint

== API ==
spam.js exports two classes: StaticCanvasMap and ZoomableCanvasMap. The only difference between them is that the latter provides a *zoom*-function which takes a feature as parameter.

= Constructor =
Both constructors take a parameters object, while both of them accept the same members.
Mandatory elements:
*element*: This can be any term that works with d3.select() and is used to lookup the element that is used as the parent of the DOM-elements the spam.js-code will create.

*data*: This is an array of objects that define what will be rendered by spam.js. spam.js can render multiple datasets, the first element in the array gets painted first. The only mandatory property is *features* which takes a FeatureCollection. (link to topojson?)
TODO put the definition of the data before the spam api up there.

Optional elements: *prepaint*, *paintfeature*, *postpaint*, *dynamicpaint*, *click*
- *width*
- *height*
