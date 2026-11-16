import type {Example} from './types.js';

const opening = `Here is the beta sign-up. The form checks itself as you type, so I only hear from it once it is valid.
<a2ui>
surface("signup")
$/form = {name: "Sam", email: "sam@example", code: "", password: "", terms: false}
root = Card(main)
main = Column([title, name, email, code, password, terms, submit])
title = Column([Text("### Join the beta"), Text("Four checks run in the renderer, without a round trip.", "caption")])
name = TextField("Name", $/form/name, "Your name", _, ?required("Tell us what to call you"))
email = TextField("Work email", $/form/email, "you@company.com", _, [?required("Email is required"), ?email("That does not look like an email address")])
code = TextField("Invite code", $/form/code, "ABC-1234", _, ?regex("^[A-Z]{3}-[0-9]{4}$", "Use the format ABC-1234"))
password = TextField("Password", $/form/password, _, "obscured", ?length(8, "At least 8 characters"))
terms = CheckBox("I agree to the beta terms", $/form/terms)
submit = Button(Text("Create account"), "primary", Event("signup", {name: $/form/name, email: $/form/email, code: $/form/code}), ?and([required($/form/name), email($/form/email), regex($/form/code, "^[A-Z]{3}-[0-9]{4}$"), length($/form/password, 8), $/form/terms], "Fix the fields above and accept the terms"))
</a2ui>`;

export const signup: Example = {
  id: 'signup',
  title: 'A form that checks itself',
  summary:
    'Validation rules travel with the form and run in the renderer; the submit button stays locked until all of them pass.',
  features: ['@checks', 'ValidationResult', 'required · email · regex · length', 'and()', 'Two-way binding'],
  prompt: 'Sign me up for the beta.',

  async start(agent) {
    await agent.reply('User prompt', opening);
  },

  async onAction(action, agent) {
    if (action.name !== 'signup') return;
    const {name, email, code} = action.context as Record<string, string>;
    await agent.reply(
      'Action: signup',
      `Welcome aboard, ${name}.
<a2ui>
surface("signup")
main = Column([Row([Icon("check"), Text("### You are in")], _, "center"), Text("We sent a confirmation to **${email}**."), Text("Invite ${code} is now used up.", "caption")])
</a2ui>`,
    );
  },
};
