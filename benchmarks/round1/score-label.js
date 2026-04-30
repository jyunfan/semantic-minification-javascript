function label(score) {
  if (score >= 90) {
    return "A";
  }
  return score >= 75 ? "B" : "C";
}

function isPassing(score) {
  return score >= 60 ? true : false;
}

module.exports = { label, isPassing };
