export default function(element, feature, parameters) {
  parameters.context.beginPath();
  parameters.path(feature);
  element.static.paintfeature(parameters, feature);
}
