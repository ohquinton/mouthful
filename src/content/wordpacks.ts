import type { Passage } from './passages';

// Word Packs: the words people use at work and trip on out loud.
// Each pack teaches meaning + how to say it, then you read the words in context with Glide.

export type PackWord = {
  word: string;
  syllables: string; // "rec·on·cil·i·a·tion", stressed syllable in capitals
  meaning: string; // one plain line
  example: string; // how people actually say it at work
};

export type WordPack = {
  id: string;
  title: string;
  pitch: string;
  free: boolean;
  words: PackWord[];
  passages: { title: string; text: string }[];
};

export const WORD_PACKS: WordPack[] = [
  {
    id: 'meetings',
    title: 'Run the Meeting',
    pitch: 'The words your manager uses without thinking. Say them like you do too.',
    free: true,
    words: [
      { word: 'prioritize', syllables: 'pry·OR·i·tize', meaning: 'Decide what matters most and do that first.', example: 'Let’s prioritize the client fix over the redesign.' },
      { word: 'stakeholder', syllables: 'STAKE·hold·er', meaning: 'Anyone affected by the work or with a say in it.', example: 'We need sign-off from every stakeholder by Friday.' },
      { word: 'bandwidth', syllables: 'BAND·width', meaning: 'The time or energy to take something on.', example: 'I don’t have the bandwidth for that this week.' },
      { word: 'consensus', syllables: 'con·SEN·sus', meaning: 'An agreement most of the group accepts.', example: 'I think we have consensus, so let’s move on.' },
      { word: 'articulate', syllables: 'ar·TIC·u·late', meaning: 'Explain something clearly.', example: 'Can you articulate the risk in one sentence?' },
      { word: 'deliverable', syllables: 'de·LIV·er·a·ble', meaning: 'A specific thing you’ve promised to hand over.', example: 'The main deliverable is the dashboard.' },
      { word: 'contingency', syllables: 'con·TIN·gen·cy', meaning: 'A backup plan in case something goes wrong.', example: 'What’s our contingency if the vendor is late?' },
      { word: 'leverage', syllables: 'LEV·er·age', meaning: 'Use something you already have to get more out of it.', example: 'We can leverage last year’s template.' },
    ],
    passages: [
      {
        title: 'Opening the Meeting',
        text: 'Thanks for joining, everyone. I want to keep this short. We have one deliverable due Friday, and every stakeholder needs to see it first. So let’s prioritize the review today and leave the redesign for next week. If anyone doesn’t have the bandwidth for their part, say so now, not on Thursday. I’d rather adjust the plan early than discover the problem late.',
      },
      {
        title: 'Closing the Meeting',
        text: 'Before we wrap up, let me articulate where we landed. We have consensus on the timeline, and we’ll leverage the template from last quarter instead of starting from scratch. Our contingency, if the vendor is late again, is to ship the summary without the charts. I’ll send the notes this afternoon. Thanks, everyone, this was a good meeting.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance Floor',
    pitch: 'The words analysts say every day and trip on every time.',
    free: false,
    words: [
      { word: 'reconciliation', syllables: 'rec·on·cil·i·A·tion', meaning: 'Checking that two sets of records match.', example: 'The reconciliation is clean for March.' },
      { word: 'custodian', syllables: 'cus·TO·di·an', meaning: 'The firm that holds assets on a client’s behalf.', example: 'The custodian file came in late again.' },
      { word: 'amortization', syllables: 'am·or·ti·ZA·tion', meaning: 'Spreading a cost or loan out over time.', example: 'The amortization schedule runs for ten years.' },
      { word: 'fiduciary', syllables: 'fi·DOO·shee·air·y', meaning: 'Legally bound to act in someone else’s best interest.', example: 'We have a fiduciary duty to the client.' },
      { word: 'derivative', syllables: 'de·RIV·a·tive', meaning: 'A contract whose value comes from another asset.', example: 'Options are the most common derivative we trade.' },
      { word: 'annualized', syllables: 'AN·nu·al·ized', meaning: 'Scaled up to show a yearly rate.', example: 'That’s about eight percent annualized.' },
      { word: 'liquidity', syllables: 'li·QUID·i·ty', meaning: 'How quickly something turns into cash without losing value.', example: 'Liquidity dried up in the afternoon.' },
      { word: 'volatility', syllables: 'vol·a·TIL·i·ty', meaning: 'How sharply a price moves up and down.', example: 'Volatility spiked after the rate decision.' },
    ],
    passages: [
      {
        title: 'Morning Update',
        text: 'Quick update from operations. The reconciliation for yesterday is clean, apart from one position where the custodian file arrived late. We’ve flagged it and expect it resolved by noon. On the market side, volatility picked up after the rate announcement, and liquidity in the smaller names was thin by the close. Nothing that changes our plan for today.',
      },
      {
        title: 'Client Call',
        text: 'As your manager, we have a fiduciary duty to explain every position clearly. The derivative exposure in the portfolio is small and fully hedged. Over the last three years, the fund has returned just under eight percent annualized, after fees. The property loan follows a standard amortization schedule, so the payments stay the same each month. Happy to walk through any of it in more detail.',
      },
    ],
  },
  {
    id: 'tech',
    title: 'Sprint Review',
    pitch: 'Sound sharp when you demo, estimate and explain what broke.',
    free: false,
    words: [
      { word: 'architecture', syllables: 'AR·chi·tec·ture', meaning: 'How the parts of a system fit together.', example: 'The architecture won’t handle that load.' },
      { word: 'asynchronous', syllables: 'ay·SYN·chro·nous', meaning: 'Not happening at the same time; it runs in the background.', example: 'The upload is asynchronous, so the page doesn’t freeze.' },
      { word: 'scalability', syllables: 'scale·a·BIL·i·ty', meaning: 'How well something keeps working as it grows.', example: 'Scalability is fine up to a million users.' },
      { word: 'infrastructure', syllables: 'IN·fra·struc·ture', meaning: 'The servers and services everything runs on.', example: 'The outage was an infrastructure problem, not our code.' },
      { word: 'authentication', syllables: 'au·then·ti·CA·tion', meaning: 'Checking that someone is who they say they are.', example: 'We moved authentication to single sign-on.' },
      { word: 'latency', syllables: 'LAY·ten·cy', meaning: 'The delay before something responds.', example: 'Latency dropped by forty percent.' },
      { word: 'deprecated', syllables: 'DEP·re·cat·ed', meaning: 'Still works, but being phased out.', example: 'That endpoint is deprecated, so don’t build on it.' },
      { word: 'iteration', syllables: 'it·er·A·tion', meaning: 'One round of building, testing and improving.', example: 'This is the second iteration of the design.' },
    ],
    passages: [
      {
        title: 'The Demo',
        text: 'This sprint we finished the second iteration of the upload flow. The big change is that uploads are now asynchronous, so the page doesn’t freeze while a file is processing. We also cut latency on the search results by about forty percent. One note: the old export endpoint is deprecated, so please move any scripts that still depend on it before next month.',
      },
      {
        title: 'The Incident Review',
        text: 'Yesterday’s outage was an infrastructure issue, not a code change. A certificate expired, and authentication failed for about twenty minutes. The architecture did what it should: the rest of the system stayed up. The lesson is about scalability of our process, not our servers. We’re adding automatic alerts so nobody has to remember renewal dates again.',
      },
    ],
  },
  {
    id: 'raise',
    title: 'Ask for the Raise',
    pitch: 'For interviews, reviews and the conversation about your pay.',
    free: false,
    words: [
      { word: 'initiative', syllables: 'i·NISH·a·tive', meaning: 'Doing something useful without being asked.', example: 'I took the initiative to automate the report.' },
      { word: 'accountability', syllables: 'ac·count·a·BIL·i·ty', meaning: 'Owning the result, good or bad.', example: 'I want more accountability for the project.' },
      { word: 'quantifiable', syllables: 'QUAN·ti·fy·a·ble', meaning: 'Something you can put a number on.', example: 'The impact is quantifiable: twelve hours a week saved.' },
      { word: 'collaborative', syllables: 'co·LAB·or·a·tive', meaning: 'Done by working well with others.', example: 'It was a collaborative effort with the data team.' },
      { word: 'compensation', syllables: 'com·pen·SAY·tion', meaning: 'Your pay, including salary and bonus.', example: 'I’d like to talk about my compensation.' },
      { word: 'trajectory', syllables: 'tra·JEC·to·ry', meaning: 'The direction something is heading over time.', example: 'I want my role to follow that trajectory.' },
      { word: 'resilient', syllables: 're·ZIL·i·ent', meaning: 'Able to recover quickly when things go wrong.', example: 'The team stayed resilient through the migration.' },
      { word: 'negotiate', syllables: 'ne·GO·shee·ate', meaning: 'Discuss terms to reach an agreement.', example: 'I’m open to negotiate the start date.' },
    ],
    passages: [
      {
        title: 'Making the Case',
        text: 'Thanks for making time for this. Over the past year I’ve taken the initiative on two projects that weren’t in my original role. The impact is quantifiable: the automated report saves the team about twelve hours a week. It was a collaborative effort, and I’d like more accountability for work like this going forward. I’d also like to talk about my compensation.',
      },
      {
        title: 'When the Answer Is Not Yet',
        text: 'I understand the budget is tight this quarter, and I’m not asking for a promise today. I’d like us to agree on what success looks like, so the next conversation about compensation has a clear answer. It’s been a difficult year and I’ve stayed resilient through it. I think my trajectory here is strong. If salary has to wait, I’m happy to negotiate other options.',
      },
    ],
  },
  {
    id: 'interview',
    title: 'Job Interview',
    pitch: 'The words strong candidates use, and the ones that trip people up under pressure.',
    free: false,
    words: [
      { word: 'analytical', syllables: 'an·a·LYT·i·cal', meaning: 'Good at breaking problems down with evidence.', example: 'I’m analytical by nature, but I like explaining the numbers.' },
      { word: 'facilitate', syllables: 'fa·CIL·i·tate', meaning: 'Run a meeting or process so it goes smoothly.', example: 'I facilitate the weekly review with operations.' },
      { word: 'proactive', syllables: 'pro·AC·tive', meaning: 'Acting before a problem happens, not after.', example: 'I try to be proactive about risks.' },
      { word: 'consistently', syllables: 'con·SIS·tent·ly', meaning: 'Every time, not just once.', example: 'We’ve consistently closed the month early.' },
      { word: 'specifically', syllables: 'spe·CIF·ic·ly', meaning: 'Exactly, in detail.', example: 'Specifically, the reports were two days late.' },
      { word: 'methodology', syllables: 'meth·o·DOL·o·gy', meaning: 'The method you follow to do something.', example: 'The methodology showed where the delay came from.' },
      { word: 'prioritization', syllables: 'pry·or·i·ti·ZAY·tion', meaning: 'Deciding what to do first.', example: 'Prioritization of high-risk accounts came first.' },
      { word: 'adaptable', syllables: 'a·DAPT·a·ble', meaning: 'Able to change your approach when things change.', example: 'I stayed adaptable when the first version failed.' },
    ],
    passages: [
      {
        title: 'Tell Me About Yourself',
        text: 'I’m a data analyst with three years of experience in financial services. I’m analytical by nature, but what I enjoy most is explaining the numbers to people who need to act on them. In my current role I facilitate a weekly review with the operations team, and we’ve consistently closed the month early. I also try to be proactive about problems before they reach a client.',
      },
      {
        title: 'A Problem I Solved',
        text: 'Specifically, our reports were arriving two days late every month. I mapped the process step by step, and the methodology showed that most of the delay came from manual checks. I proposed an automated version, with prioritization of the highest-risk accounts first. The first version failed, so I stayed adaptable and rebuilt it. Now the reports arrive on time.',
      },
    ],
  },
  {
    id: 'present',
    title: 'Present with Clarity',
    pitch: 'Long words that sound great on slides and trip you up out loud.',
    free: false,
    words: [
      { word: 'agenda', syllables: 'a·JEN·da', meaning: 'The list of what you’ll cover.', example: 'Here’s the agenda for the next fifteen minutes.' },
      { word: 'preliminary', syllables: 'pre·LIM·i·nar·y', meaning: 'Early, not final yet.', example: 'These are preliminary results from the pilot.' },
      { word: 'significant', syllables: 'sig·NIF·i·cant', meaning: 'Important enough to notice.', example: 'One significant finding surprised us.' },
      { word: 'recommendation', syllables: 'rec·om·men·DAY·tion', meaning: 'What you suggest doing.', example: 'My recommendation is to start in January.' },
      { word: 'summarize', syllables: 'SUM·ma·rize', meaning: 'Say the main points briefly.', example: 'To summarize, the pilot worked.' },
      { word: 'comprehensive', syllables: 'com·pre·HEN·sive', meaning: 'Covering everything.', example: 'We ran a comprehensive review.' },
      { word: 'subsequently', syllables: 'SUB·se·quent·ly', meaning: 'Afterwards.', example: 'We subsequently fixed the three biggest gaps.' },
      { word: 'implementation', syllables: 'im·ple·men·TAY·tion', meaning: 'Putting a plan into action.', example: 'Implementation starts across all teams.' },
    ],
    passages: [
      {
        title: 'The Opening',
        text: 'Good morning, everyone. Here’s the agenda for the next fifteen minutes. First, I’ll share the preliminary results from our pilot. Then I’ll walk through one significant finding that surprised us. Finally, I’ll make a recommendation and leave time for your questions. If anything is unclear as we go, please stop me.',
      },
      {
        title: 'The Close',
        text: 'To summarize, the pilot worked better than we expected. We ran a comprehensive review of every account, and we subsequently fixed the three biggest gaps. The next step is implementation across all teams, which we can start in January. Thank you for your time. I’m happy to take questions.',
      },
    ],
  },
];

export function getPack(id: string): WordPack | undefined {
  return WORD_PACKS.find((p) => p.id === id);
}

/** Pack passages use ids like `w.<packId>.<n>`. */
export function packPassageId(packId: string, n: number) {
  return `w.${packId}.${n}`;
}

export function packPassage(id: string): Passage | undefined {
  const m = /^w\.([a-z]+)\.(\d+)$/.exec(id);
  if (!m) return undefined;
  const pack = getPack(m[1]);
  const p = pack?.passages[Number(m[2])];
  if (!pack || !p) return undefined;
  return { id, title: `${p.title} · ${pack.title}`, level: 'Flowing', text: p.text };
}

/** Every pack word, lowercased, for looking up meanings anywhere in the app. */
export const DICTIONARY: Map<string, PackWord & { packId: string }> = new Map(
  WORD_PACKS.flatMap((pack) => pack.words.map((w) => [w.word.toLowerCase(), { ...w, packId: pack.id }] as const)),
);
