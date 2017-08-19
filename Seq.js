// Original work, Jensen Turner 2017
// Sequence object for continually iterating through a sequence, with next, current, and retry functions

let Seq = function (seq) {
  this._seq = seq;
  this._pos = -1;
};
Seq.prototype.next = function() {
  if (this._pos === this._seq.length - 1) {
    this._pos = 0;
  } else {
    this._pos++;
  }
  return this._seq[this._pos];
};
Seq.prototype.current = function() {
  return this._seq[this._pos];
};
Seq.prototype.retry = function() {
  if (this.pos <= 0) {
    this._pos = this._seq.length - 1;
  } else {
    this._pos--;
  }
  return this._seq[this._pos];
};

module.exports = Seq;
