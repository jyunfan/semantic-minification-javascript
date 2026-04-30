function isEligible(user, score) {
  const active = user.active === true;
  const banned = user.banned === false;
  if (active && banned && score > 10) {
    return true;
  }
  return false;
}

function status(user) {
  if (user.active === true) {
    return "active";
  }
  return "inactive";
}

module.exports = { isEligible, status };
