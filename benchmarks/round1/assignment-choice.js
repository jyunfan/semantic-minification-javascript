function price(member, total) {
  let discount;
  if (member === true) {
    discount = 0.8;
  } else {
    discount = 1;
  }
  return total * discount;
}

function gate(flag) {
  let value;
  if (flag === false) {
    value = "closed";
  } else {
    value = "open";
  }
  return value;
}

module.exports = { price, gate };
