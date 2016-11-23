// git log 1.4-releases...1.5-releases --format='{"sha1": "%h",  "email": "%ae", "date": "%aI", "subject": "%s"}' > changelog.json
// git log 78ea8bfb69091a422c0668ed42dc95ec22e83065...1.5-releases --format='{"sha1": "%h",  "email": "%ae", "date": "%aI", "subject": "%s"}' > changelog.json

var changelog = require('./changelog.json');
var _ = require('lodash');

var version = '1.5.0-beta.2';
console.log(`
The Compass Team is proud to announce our latest release on the Beta channel, \`${version}\`. This release is now generally available from the [MongoDB Download Center][dlcenter] for [macOS][macOS] and [Windows][Windows].

[dlcenter]: https://www.mongodb.com/download-center?jmp=hero#compass
[macOS]: https://downloads.mongodb.com/compass/beta/mongodb-compass-${version}-darwin-x64.dmg
[Windows]: https://downloads.mongodb.com/compass/beta/mongodb-compass-${version}-win32-x64.exe
`);

var tickets = [];
var prs = [];


var changes = _.chain(changelog).map((c) => {
  var m = /([compass|int]+)[-\s]?(\d+)/ig.exec(c.subject);
  if (m) {
    var ticket = `${m[1]}-${m[2]}`.toUpperCase();
    tickets.push(ticket);
    c.subject = c.subject.replace(m[0], `[${ticket}][${ticket}]`);
  }

  var pr = /\(#(\d+)\)/.exec(c.subject);
  if (pr) {
    prs.push(pr[1]);
    c.subject = c.subject.replace(`#${pr[1]}`, `[#${pr[1]}][pr-${pr[1]}]`);
  }

  c.subject = _.trim(c.subject.replace(/backport:?/i, ''));

  return `- ${c.subject}`;
})
.sort()
.value();

console.log(changes.join('\n'));

tickets = _.uniq(tickets);
console.log(`\n\n\n<!-- Tickets (${tickets.length}) -->`);
tickets.forEach((t) => {
  console.log(`[${t}]: https://jira.mongodb.org/browse/${t}`);
});
// console.log(tickets);

prs = _.uniq(prs);
console.log(`\n\n\n<!-- Pull Requests (${prs.length}) -->`);
console.log(_.chain(prs)
  .map((pr) => `[pr-${pr}]: https://github.com/10gen/compass/pull/${pr}`)
  .join('\n')
  .value());
