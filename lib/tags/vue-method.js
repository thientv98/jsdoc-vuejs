exports.name = 'vue-method';

exports.options = {
  canHaveType: true, // type of event-payload
  canHaveName: true, // name of emitted event
  onTagged(doclet, tag) {
    doclet._isVueDoc = true;
    doclet._vueMethod = doclet._vueMethod || [];
    doclet._vueMethod.push(tag.value || {});
  },
};
