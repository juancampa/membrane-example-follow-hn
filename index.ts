// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object is durable across program updates. Store any data here.
import { nodes, root, state } from "membrane";

// Dependency nodes
const { hn, sms } = nodes;

// Sets up a "cron" timer that invokes `check` periodically.
export function configure() {
  root.check.$cron("30 35 * * * *");
}

// Invoke this action to start following a user.
export async function follow({ username }) {
  // Query the user to find out their id and their last submitted item (post, comment, etc).
  const { id, submitted } = await hn.users
    .one({ id: username })
    .$query(`{ id submitted { items { id } } }`);
  const lastSeen = submitted?.items?.[0]?.id ?? 0;
  state[username] = { id, lastSeen };
}

// Invoked periodically to check if there are new items.
export async function check() {
  for (const [username, { lastSeen }] of Object.entries(state)) {
    const items = await hn.users
      .one({ id: username })
      .submitted.items.$query(`{ id }`);

    // The first item returned by the API is the most recent one
    const latest = (items ?? [])[0];
    if (latest?.id! > (lastSeen as number)) {
      // Send me a text
      // Note: This will only send a text for the latest items.
      const url = `https://news.ycombinator.com/item?id=${latest.id}`;
      await sms
        .send({ message: `New HN post from ${username}: ${url}` })
        .$invoke();
      state[username] = latest.id!;
    }
  }
}
