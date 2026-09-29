// Knowledge drawn from David Gray-Hammond's books and NeuroHub Community's guides: Autism and Psychosis, A Brief and
// Honest Guide to Drugs for Neurodivergent People, Re-Storying Autism (with Helen Edgar), The New Normal, Unusual
// Medicine, and Unashamed Autistic. Same shape as kb.js entries.
//
// Two rules for this file:
//  1. Where something is a community concept, a personal view or a hypothesis (not settled science), the text says so.
//  2. Nothing here tells anyone to start, stop or change medication, or gives doses. Those decisions belong with a prescriber.

export const KB_BOOKS = [
  // ------------------------------------------------------------------ attention, energy, burnout
  {
    id: 'lilypadding', title: 'Lilypadding (gentle transitions)',
    terms: ['lilypad', 'lilypads', 'lilypadding', 'lilipad', 'lilipadding', 'stepping stones', 'bridge between activities', 'warm up period'],
    what: 'Lilypadding is a community concept from Tanya Adkin. It pictures your day as a series of lilypads: small islands of safety, familiarity, interest or sensory comfort. Moving from one thought, feeling, activity or place to the next is a jump between pads, and every jump costs energy.',
    why: 'Because of monotropic attention, each transition can take real effort. Too many jumps in a row, or jumps with no warning, leave you with nothing in reserve. That is not resistance. It is the cost of moving.',
    helps: 'Put a stepping stone between things: a snack, a stim, music, a few minutes of your interest. Ask for warnings before changes. Do not pack the day. Give yourself a warm-up before something demanding and a decompression after it, and let yourself go back to a safe pad without guilt.',
  },
  {
    id: 'monotropicsplit', title: 'Monotropic split, meerkat mode and the monotropic spiral',
    terms: ['monotropic split', 'meerkat mode', 'meerkat', 'monotropic spiral', 'spiral', 'spiralling', 'spiraling', 'hypervigilant', 'hypervigilance', 'cognitive debt', 'racing thoughts', 'cant stop thinking', "can't stop thinking"],
    what: 'These are community concepts from Tanya Adkin, used by David Gray-Hammond. A monotropic split is when too many demands each need your whole attention, so your attention is torn apart and burns through your resources. Meerkat mode is the hypervigilant, on-alert state that can follow. A monotropic spiral is when your attention gets locked onto something distressing and pulls in more and more unrelated things.',
    why: 'They are ways of describing how an overloaded monotropic mind can end up stuck on the thing that hurts. They come from lived experience and have not been fully tested in research yet, so treat them as useful maps rather than proven facts.',
    helps: 'Cut demands as far as you can. Give your attention somewhere safe to land, ideally a special interest or another absorbing, low-stakes flow activity. Reduce sensory input, get food and water, and if you can, have a calm person nearby (co-regulation). If the spiral is about fear of being harmed and it will not ease, please reach out to someone you trust or a professional.',
  },
  {
    id: 'atypicalburnout', title: 'Atypical burnout (when burnout is loud, not quiet)',
    terms: ['atypical burnout', 'loud burnout', 'burnout mania', 'manic burnout', 'burnout and mania', 'cant stop but exhausted', "can't stop but exhausted", 'wired and tired'],
    what: 'Atypical burnout is a community term (Adkin, Gray-Hammond) for burnout that does not look like tired, quiet withdrawal. It can look like restlessness, impulsivity, racing thoughts, feeling on edge, emotional flooding, or a high-energy “can’t stop” state, especially in AuDHD people.',
    why: 'When ADHD keeps pushing forward and Autistic capacity is running out, you can end up unable to rest and unable to keep going. Being unable to stop does not mean you are not burnt out.',
    helps: 'Build in tiny rests and movement or sensory breaks between things, not only at the end of the day. Use gentle, predictable transitions. Protect recovery after hyperfocus. Cut the load, and give your interest-led attention a safe place to go. If your thoughts feel like they are moving away from reality, tell someone you trust or a clinician early.',
  },
  {
    id: 'burnoutrecovery', title: 'Recovering from burnout: reconnection, not “bouncing back”',
    terms: ['burnout recovery', 'recover from burnout', 'recovering from burnout', 'how to recover', 'recovery from burnout', 'reconnection'],
    what: 'In Re-Storying Autism, burnout is described as a crisis of connection: to your body (signals get muted or scrambled), to your life (skills and routines slip away) and to your community (you withdraw). Recovery is about slowly reconnecting, not forcing a return to “normal”.',
    why: 'You are unlikely to come back exactly as you were, and you should not have to. If you go back to the same demands, you go back to the same burnout. Change is part of recovery.',
    helps: 'Rest in ways that actually restore you (which may not be socialising or “doing more”), more time with your interests and stims, fewer demands, sensory safety, food, water and sleep, and gentle contact with people who understand. Notice which demands you can drop for good. Burnout is not something medication treats, though a doctor can help with anything that co-occurs, such as low mood, anxiety or sleep.',
  },
  {
    id: 'burnoutvsdepression', title: 'Burnout or depression?',
    terms: ['burnout or depression', 'burnout vs depression', 'depression or burnout', 'is it depression', 'am i depressed', 'depressed', 'depression'],
    what: 'Burnout and depression can look alike (exhaustion, withdrawal, low motivation) and can happen together. In Autistic and ADHD people, depression can show up as withdrawing from special interests, more rigidity or demand avoidance, more stimming, losing the ability to mask, unexplained aches, or looking flat and “fine”. Burnout tends to come after a long stretch of overload and masking, with lost skills and low tolerance for noise and demands.',
    why: 'The difference matters because burnout mainly needs rest, fewer demands and accommodations, while depression may also benefit from talking therapy or medication. Many people have both.',
    helps: 'You do not have to work out which it is alone. Tell a doctor or therapist who understands neurodivergence what you are noticing and what has been going on. If you have thoughts of harming yourself, please use the Help button or talk to someone right away.',
  },
  {
    id: 'energyaccounting', title: 'Energy accounting',
    terms: ['energy accounting', 'energy account', 'pacing', 'pace myself', 'energy budgeting', 'budget my energy'],
    what: 'Energy accounting is keeping track of how much energy you have and what different things cost. Christine Miserandino’s spoon theory is a popular way to do it. Neurodivergent people often pay extra for noise, masking, transitions, social time and uncertainty.',
    why: 'If you spend energy you do not have, you borrow from tomorrow and heading towards burnout gets easier.',
    helps: 'Notice what costs you and what refills you. Plan recovery time after costly things. Do the important thing while you have capacity. Use the Check-in in the Toolkit to see your own patterns over time.',
  },

  // ------------------------------------------------------------------ senses and body
  {
    id: 'eightsenses', title: 'The eight senses',
    terms: ['eight senses', '8 senses', 'proprioception', 'vestibular', 'balance sense', 'body awareness sense', 'deep pressure', 'weighted blanket', 'sensory diet', 'sensory seeking', 'sensory avoiding', 'sensory avoidance'],
    what: 'Re-Storying Autism describes an eight-sense world: sight, hearing, touch, taste and smell, plus proprioception (where your body is and how much force it is using), the vestibular sense (balance and movement) and interoception (signals from inside your body). Each can be turned up, turned down, or both on the same day, and each can be sought out or avoided.',
    why: 'When several senses are strained at once, the load adds up and you can tip into overload. Crashing into things, rocking, pacing and seeking pressure are often proprioceptive or vestibular regulation, not misbehaviour.',
    helps: 'Learn your own profile: which senses hurt, which soothe, which you seek. Then design around it. Deep pressure (a weighted blanket, a firm squeeze), movement breaks, headphones, sunglasses, soft clothes, and familiar textures and smells all help different people. Some people get relief from the same thing that overloads someone else.',
  },
  {
    id: 'coregulation', title: 'Co-regulation',
    terms: ['co-regulation', 'coregulation', 'co regulation', 'co-regulate', 'coregulate', 'regulate with someone', 'someone calm', 'borrow calm', 'self regulate', 'self-regulate', 'self regulation'],
    what: 'Co-regulation is using someone else’s steady presence to help your own nervous system settle. It might be sitting quietly beside you, slowing their voice, dimming the lights, a familiar object, or just being there without asking anything of you. It works when there is trust and no power struggle.',
    why: 'Many neurodivergent people are told to “self-regulate” when they have never had the safe company to co-regulate first. Needing a safe person is a normal human need.',
    helps: 'If you can, tell a trusted person in advance what helps (“sit near me and don’t talk”). If you are supporting someone, get calm yourself first, ask for nothing, and stay near. It is fine to use Phoenix in this way too, though a real person who you feel safe with is better.',
  },
  {
    id: 'nesting', title: 'Nesting and safe retreat',
    terms: ['nesting', 'nest', 'safe retreat', 'hide away', 'hiding away', 'need to hide', 'retreat', 'cocoon', 'blanket fort'],
    what: 'Nesting is making a sensory refuge: a place where the world stops pressing in and you are back in control. It might be a corner with a blanket and headphones, a dim room, a den, a favourite chair, or a ritual with familiar things. It is a recognised way of recovering, especially in burnout.',
    why: 'Retreating is often mistaken for avoidance or sulking. It is self-preservation. Your nervous system is asking for less.',
    helps: 'Make a nest that is ready before you need it. Protect it from other demands. You do not owe anyone an explanation for needing it. If you are living with someone, agreeing a signal (“I’m going to nest”) can help.',
  },
  {
    id: 'lowdemand', title: 'Low-demand living',
    terms: ['low demand', 'low-demand', 'lower demands', 'reduce demands', 'demands too high', 'too many demands', 'fewer musts', 'low demand parenting'],
    what: 'A low-demand approach deliberately reduces the demands on you (or on the person you support), including how demands are worded, and builds a life around capacity instead of expectation. It does not mean no boundaries. It means flexible routines, fewer forced transitions, invitations instead of orders, and “maybe later” instead of “must”.',
    why: 'Burnout grows when demands exceed capacity for too long. Cutting demands frees up capacity, lowers anxiety and helps nervous systems settle, which is especially important for people with a demand-avoidant profile.',
    helps: 'Look at the week and ask what is a genuine must, and what is a “should” you picked up along the way. Turn commands into choices. Cancel without guilt when your capacity is low. Cluster tasks, and leave gaps.',
  },
  {
    id: 'glimmers', title: 'Glimmers and penguin pebbling',
    terms: ['glimmers', 'glimmer', 'penguin pebbling', 'pebbling', 'pebble', 'autistic joy', 'things that make me happy', 'what makes me happy'],
    what: 'Glimmers are the opposite of triggers: small moments that bring a spark of joy or ease. Penguin pebbling is sharing small gifts or acts of kindness based on someone’s interests: “I saw this and thought of you”, a meme, a nice stone. Autistic joy is often intense and tied to interests, senses and connection with people who get you.',
    why: 'Neurodivergent life gets described almost entirely in terms of difficulty. Joy and connection are just as real, and noticing them helps.',
    helps: 'Keep a little list of glimmers. Notice them when they happen. Send someone a pebble. Protect time for the things you love.',
  },
  {
    id: 'scripting', title: 'Scripting and echolalia',
    terms: ['scripting', 'scripts', 'rehearse', 'rehearsing conversations', 'echolalia', 'echoing', 'gestalt language', 'repeat phrases', 'repeating words', 'quoting'],
    what: 'Scripting is using ready-made words or phrases: rehearsing a conversation, quoting a show, or repeating words and phrases that carry meaning. Echolalia is repeating or echoing words or sounds, and for many people (including many gestalt language processors) those phrases carry real meaning.',
    why: 'Scripting can be a mask, and it can also be a helpful way to lower anxiety before a hard conversation. Echoed phrases are communication. They are not meaningless.',
    helps: 'If you rehearse to feel safe, that is fine. The Scripts in the Toolkit have ready wording you can change. If you are with someone who echoes, listen for what the phrase means to them.',
  },

  // ------------------------------------------------------------------ identity, community, society
  {
    id: 'neuroqueer', title: 'Neuroqueer',
    terms: ['neuroqueer', 'neuroqueering', 'neuro queer', 'neuroqueer theory', 'neurocosmopolitan', 'neurocosmopolitanism', 'neuroprovincialism', 'chaotic self', 'neurofuturist'],
    what: 'Neuroqueer is a theory developed by Nick Walker: to neuroqueer is to free yourself by subverting neuronormative (and heteronormative) expectations, and it can be a practice, an identity and a way of being. David Gray-Hammond builds on it with the idea of the Chaotic Self: identity is not fixed but keeps changing as you learn new words and meet new environments. Neurocosmopolitanism is the hoped-for future in which no one kind of mind is treated as the standard.',
    why: 'These ideas offer a different way of thinking about yourself: not as a broken version of “normal”, but as someone free to explore who they are.',
    helps: 'You are allowed to change, experiment and be more than one thing. Finding words that fit you, and other people who share them, is often part of it.',
  },
  {
    id: 'neuronormativity', title: 'Neuronormativity and the pathology paradigm',
    terms: ['neuronormativity', 'neuronormative', 'pathology paradigm', 'pathologise', 'pathologize', 'pathologising', 'medical model', 'deficit model', 'deficit based', 'what is normal'],
    what: 'Neuronormativity is the invisible standard for what counts as normal thoughts, behaviour, emotions, communication and energy: eye contact, speech, small talk, flexible attention, independence and productivity. The pathology paradigm treats anything outside that standard as a disorder to fix. The neurodiversity paradigm treats it as natural variation.',
    why: 'Neuronormativity presents itself as universal, so people who differ often absorb the belief that they are the problem. Beardon’s equation puts it simply: Autism + Environment = Outcome. Change the environment and the outcome changes.',
    helps: 'When something is hard, ask what in the environment or expectations could change before asking what is wrong with you. Notice which of your “shoulds” are neuronormative rules you picked up rather than things you actually need.',
  },
  {
    id: 'neurodivergencecompetence', title: 'Neurodivergence-competence (and “neuro-affirming”)',
    terms: ['neurodivergence competent', 'neurodivergence-competent', 'neurodivergent competent', 'neuro affirming', 'neuro-affirming', 'neuro affirmative', 'neuro-affirmative', 'affirming therapist', 'affirming practitioner', 'finding a therapist', 'find a therapist', 'find a professional'],
    what: 'Neurodivergence-competence is a term from Tanya Adkin for cultural competence in neurodivergent lived experience. It is used instead of “neuro-affirming” by some, because that phrase has been turned into a buzzword by organisations that say the words without changing their practice. It means understanding through neurodivergent knowledge and culture, and changing environments rather than the person.',
    why: 'A professional who says “neuro-affirming” may or may not actually work this way. Words are cheap. Practice is what matters.',
    helps: 'When looking for support, ask: how do you understand autism/ADHD? Do you work with a deficit or a social model? Do you use behavioural approaches such as ABA or PBS? What adjustments can you make for my sensory and communication needs? Are you neurodivergent yourself, or do you learn from neurodivergent people? The Neurodivergent Practitioner Directory (neurodivergentpractitioners.org) lists neurodivergent practitioners.',
  },
  {
    id: 'ausocial', title: 'AuSocial: Autistic social culture',
    terms: ['ausocial', 'ausociality', 'autistic social', 'autistic culture', 'autistic sociality', 'asocial', 'antisocial', 'no friends', 'friendless', 'make friends', 'making friends', 'lonely', 'loneliness', 'infodump culture', 'autistic community', 'neurokin'],
    what: 'Autistic people are not asocial. They socialise differently, in ways that have their own culture: directness as respect, sharing interests as intimacy, parallel presence (side by side, doing different things), quiet companionship, memes and layered humour, mutual aid, and a strong sense of protecting people who are marginalised. David Gray-Hammond calls this being AuSocial. Neurokin is a word for others who share your kind of mind.',
    why: 'Research on the double empathy problem suggests communication often flows well between Autistic people. Community connectedness has been linked to lower minority stress and better wellbeing.',
    helps: 'Look for spaces where you do not have to translate yourself. Online spaces can be a real, valid place to belong: text, side-by-side co-working, shared interests and long infodumps. NeuroHub Community’s online community is one option, and you can go at your own pace: https://connect.neurohubcommunity.org/p/join',
  },
  {
    id: 'minoritystress', title: 'Minority stress and everyday trauma',
    terms: ['minority stress', 'trauma', 'traumatised', 'traumatized', 'everyday trauma', 'small things', 'bullied', 'bullying', 'bullied at school', 'school trauma', 'cumulative trauma', 'complex trauma', 'cptsd', 'c-ptsd', 'ptsd', 'gaslit', 'gaslighting', 'invalidated'],
    what: 'For neurodivergent people, trauma is often not one big event. It builds from many small things: sensory pain, being corrected or punished for how you naturally are, bullying, invalidation, being made to mask, medical and institutional harm, and being disbelieved. That accumulation is called minority stress when it comes from living as a marginalised group, and it is a recognised risk to mental health. Complex PTSD is common and often missed.',
    why: 'When your reactions look “too big” for the trigger, it is usually because the trigger is the last of many. The body remembers even when the mind cannot explain why. It is proportional to your internal experience.',
    helps: 'Safety comes first: predictability, sensory comfort, boundaries and people who believe you. Trauma work should come after safety and stabilisation and be paced and consented to. Peer support from others with similar experiences is often described as deeply healing. A trauma-informed practitioner who understands neurodivergence is worth looking for.',
  },
  {
    id: 'boundaries', title: 'Boundaries as self-protection',
    terms: ['boundaries', 'boundary', 'set boundaries', 'setting boundaries', 'saying no', 'people pleasing', 'people-pleasing', 'i cant say no', "i can't say no"],
    what: 'Boundaries are not punishments or rules for other people. They are the shape of what your nervous system needs: time alone after an event, predictability, room to stim, avoiding certain sounds or textures, slower transitions, clear expectations. Honouring them is not enabling avoidance. It is protecting your regulation.',
    why: 'Without boundaries you are chronically overloaded, which leads towards burnout. Many neurodivergent people learned to ignore their own limits to keep others comfortable.',
    helps: 'Notice what you keep needing. Say it plainly and early, before you reach breaking point. The Scripts in the Toolkit have wording. It is also fine for your boundaries to differ from other neurodivergent people’s, and to change from day to day.',
  },
  {
    id: 'unmasking', title: 'Unmasking (it should be your choice)',
    terms: ['unmasking', 'unmask', 'stop masking', 'drop the mask', 'take the mask off', 'be myself', 'authentic self', 'authenticity'],
    what: 'Masking is often a safety strategy, and Re-Storying Autism is clear that nobody should be expected to just “unmask” when it does not feel safe. Choosing when to mask and when not to should be yours.',
    why: 'Unmasking too fast, in the wrong place, can be risky. Masking constantly, in every place, wears you down.',
    helps: 'Start where it is safe: alone, then with one safe person, then in places that welcome you. Notice what you do automatically and ask whether you want to. Find spaces where masking is not expected.',
  },
  {
    id: 'curecultur', title: 'Cure culture, ABA and behavioural approaches',
    terms: ['cure culture', 'autism cure', 'cure autism', 'aba', 'applied behaviour analysis', 'applied behavioural analysis', 'applied behavior analysis', 'pbs', 'positive behaviour support', 'behaviourism', 'behaviorism', 'compliance', 'mms', 'bleach', 'chlorine dioxide', 'hyperbaric', 'chelation', 'quack cure', 'indistinguishable from peers'],
    what: 'Cure culture is the belief that autism should be removed. It includes behavioural approaches such as ABA and, in the guides, positive behaviour support (PBS), and dangerous fake treatments such as miracle mineral solution (bleach), chelation and hyperbaric oxygen, which have harmed and killed Autistic people. NeuroHub’s position is that these approaches are not neurodivergence-competent, because they aim at compliance and looking normal instead of at understanding and meeting needs.',
    why: 'You cannot remove autism from an Autistic person without removing the person. Behavioural “treatment” teaches masking and can cause lasting trauma. The reason for a behaviour is nearly always an unmet need.',
    helps: 'Support that works asks what the person needs, adjusts the environment, respects communication in any form and centres safety and belonging. If you have been through a behavioural programme and it hurt, that is a real harm, not you failing at it. Never use or accept bleach or similar “cures”.',
  },
  {
    id: 'nothingaboutus', title: 'Autistic pride and “not your tragedy, not your inspiration”',
    terms: ['autistic pride', 'pride', 'neurodivergent pride', 'tragedy', 'inspiration porn', 'superpower', 'autism is a gift', 'autism is a superpower', 'aggressively neutral', 'nothing about us without us', 'presume competence', 'happy disabled'],
    what: 'Autistic pride is not a claim to be superior. It is a refusal to be ashamed. David Gray-Hammond describes being Autistic as “aggressively neutral”: not inherently good or bad, with strengths and struggles like anyone. He pushes back on the tragedy story, the “gift” or “superpower” story, and inspiration porn (praising disabled people for doing ordinary things). “Nothing about us without us” means Autistic people should shape everything that concerns them, and presuming competence means assuming people can understand and speak for themselves.',
    why: 'You can be proud and struggling at the same time. Being disabled and happy are not opposites.',
    helps: 'You do not have to pretend it is all positive to feel pride, and you do not have to pretend it is all pain. Both can be true.',
  },
  {
    id: 'acquiredneurodivergence', title: 'Acquired neurodivergence and mental health',
    terms: ['acquired neurodivergence', 'acquired neurodivergent', 'mad pride', 'mental illness', 'mental health condition', 'sanism', 'saneism', 'psychiatry', 'psychiatric', 'psychiatrist', 'diagnosis of mental illness'],
    what: 'David Gray-Hammond and others use the term acquired neurodivergence for minds that have been changed by experiences such as trauma, so that conditions often called mental illness (for example psychosis, depression or anxiety) can be seen as part of neurodiversity too. Mad pride is a movement that reclaims “mad” and resists stigma. This is a view within some neurodivergent communities. It is not the official position of medicine, and many people (including him) also value medication and psychiatric support as tools.',
    why: 'People who are neurodivergent in the “innate” sense are sometimes distanced from people with psychosis or other severe mental distress. The books call that lateral discrimination and argue that communities should welcome everyone.',
    helps: 'You can describe your experiences in whichever words feel right. If you use medication or see a psychiatrist, that does not conflict with any of this. Both the “illness” and the “neurodivergence” framings are used by real people, and neither is a failure.',
  },
  {
    id: 'psychosis', title: 'Psychosis, voices and paranoia (Autistic experience)',
    terms: ['psychosis', 'psychotic', 'hearing voices', 'hear voices', 'voice hearer', 'voice-hearer', 'hallucination', 'hallucinations', 'hallucinating', 'delusion', 'delusions', 'paranoid', 'paranoia', 'schizophrenia', 'schizophrenic', 'schizoaffective', 'seeing things', 'someone is watching me', 'people are after me'],
    what: 'Psychosis means a break from shared reality: hearing or seeing things others do not, or holding fixed beliefs that others do not share, often with fear. It is more common among Autistic people than most people realise and is heavily stigmatised, though people with psychosis are far more likely to be harmed than to harm others. In Autism and Psychosis, David Gray-Hammond describes his own psychosis alongside being Autistic and ADHD, and describes warning signs such as a change in mood, more irritability or overwhelm, hearing sounds that are not there, growing suspicion, and hopelessness.',
    why: 'Psychosis often follows trauma, severe overload or burnout, poor sleep, or substance use. Autistic pattern-spotting can run away with itself under stress and start joining unrelated things into threatening patterns. Autistic people can also mask psychosis, which means it can be missed by professionals.',
    helps: 'If you are having these experiences and are frightened, please tell someone you trust and speak to a doctor or mental health service. If you feel unsafe, use the Help button now. If you are supporting someone: David’s own tips are (1) do not try to argue them out of a belief, because that tends to make it stronger. Instead acknowledge that it feels real to them and act on the fear (close the curtains, do not debate whether anyone is watching); (2) gentle distraction that draws attention elsewhere, such as a game or music; and (3) headphones and music to cover voices. These are one person’s tools, they will not suit everyone, and they are not a substitute for professional help, especially if anyone might be in danger.',
  },
  {
    id: 'burnoutpsychosis', title: 'The burnout-to-psychosis cycle (community concept)',
    terms: ['burnout to psychosis', 'burnout psychosis', 'burnout-to-psychosis', 'psychosis cycle', 'psychosis and burnout', 'burnout and psychosis'],
    what: 'The burnout-to-psychosis cycle (Gray-Hammond and Adkin, building on Adkin’s work) is a community concept, not yet established science. It proposes that: too many demands cause a monotropic split and burnout; burnout leads to meerkat mode, hypervigilance and sometimes mania; attention gets stuck in a monotropic spiral around something distressing; and psychosis can follow, leaving the person burnt out and restarting the cycle.',
    why: 'It gives some people a way to make sense of their own experience, especially AuDHD people, and it suggests that psychosis in some Autistic people is tied to burnout and can be helped by addressing burnout. It is a hypothesis and needs research. Some experiences of psychosis are not connected to it.',
    helps: 'Breaking the cycle means addressing the demands and the environment, not just the episode: rest, sensory safety, protected time for interests and joy, and changes to what led to burnout. Psychiatric support can help with psychotic and mood symptoms and is worth using where needed. Look for professionals who understand Autistic experience, because burnout-related psychosis can be mistaken for something else.',
  },
  {
    id: 'medication', title: 'Psychiatric and other medication when you are neurodivergent',
    terms: ['medication', 'meds', 'medicine', 'antipsychotic', 'antipsychotics', 'antidepressant', 'antidepressants', 'ssri', 'side effects', 'side effect', 'paradoxical reaction', 'start low go slow', 'stopping medication', 'come off medication', 'coming off my meds', 'titration', 'adhd medication', 'stimulant medication', 'methylphenidate', 'lisdexamfetamine', 'prescriber', 'stop taking my meds', 'stop my medication'],
    what: 'Medication can be a real, useful tool. Autistic people often report unusual, rare or paradoxical reactions to medication (for example a stimulant making you drowsy, or a sleep or anxiety medicine making things worse) and stronger side effects at lower doses, though there is little research yet. Many people also find it hard to take medication reliably (executive function, stigma, or needing to eat first when food is hard to get).',
    why: 'Most trials do not include Autistic people, so it is often assumed you will respond like everyone else. The books describe the harm-reduction approach “start low, go slow”: start with the lowest reasonable dose and raise it very slowly.',
    helps: 'You can ask your prescriber about starting low and going slow, about the side effects to watch for, and about what to do if you cannot eat before a dose. Reminders and routines can help you remember. I cannot advise you to start, stop or change any medication or tell you a dose. Stopping some medicines suddenly can be dangerous, so please talk to your prescriber first, including when you feel well or when the side effects are hard.',
  },

  // ------------------------------------------------------------------ substances (harm reduction)
  {
    id: 'substanceuse', title: 'Substance use and addiction (no judgement)',
    terms: ['drugs', 'drug use', 'substance use', 'substance misuse', 'addiction', 'addicted', 'addict', 'alcohol', 'drinking too much', 'drink too much', 'cannabis', 'weed', 'cocaine', 'mdma', 'ecstasy', 'ketamine', 'opioid', 'opioids', 'benzo', 'benzos', 'diazepam', 'spice', 'self medicating', 'self-medicating', 'self medicate', 'sober', 'sobriety', 'relapse', 'craving', 'cravings', 'using again'],
    what: 'Autistic and ADHD people are more likely to have difficulties with substances. The NeuroHub guide names common reasons: substances can dampen sensory overload and anxiety, make masking cheaper, give a shortcut to emotional relief, ease alexithymia, satisfy reward-seeking, and fill unmet support needs. Addiction here is understood as a health matter and often as a response to unmet needs and trauma, not a moral failing or a sign of a bad person. Shame makes it worse, not better.',
    why: 'David Gray-Hammond writes from ten years of recovery. He describes addiction as a survival strategy, and recovery as building a life where it is easier not to use, often including emotional sobriety and finding an Autistic community. Recovery looks different for different people: for some it is abstinence, for others a relationship with substances that no longer causes harm. Neither is inherently better.',
    helps: 'If you are worried about your use, or someone else’s, you deserve non-judgemental support. Good options are services that understand neurodivergence, peer support (including SMART Recovery: smartrecovery.org.uk), and talking to a doctor. In the UK, FRANK (talktofrank.com) gives free, confidential advice. If you want to talk it through with me, I will listen without judging. I cannot tell you how much of anything is safe to take.',
  },
  {
    id: 'harmreduction', title: 'Harm reduction basics',
    terms: ['harm reduction', 'stay safe', 'safer use', 'safe to use', 'safer', 'never use alone', 'dont mix', "don't mix", 'mixing drugs', 'drug testing', 'test kit', 'fentanyl test', 'naloxone', 'narcan', 'nyxoid', 'the loop', 'pma', 'pmma', 'nitazene', 'redose', 'redosing', 'taking too much', 'unknown pill', 'unknown substance'],
    what: 'Harm reduction means keeping people alive and safer without demanding abstinence. The NeuroHub guide’s core points: know what you have taken (drug-checking services such as The Loop, and test kits, can spot dangerous substances such as PMA or fentanyl); do not use alone, especially depressants or opioids; do not mix substances, especially depressants, which can stop breathing; start low, go slow, and do not re-dose before the first dose has worked; carry naloxone if you or anyone near you uses opioids (it is free in many UK pharmacies and services); and if you do not know what something is, do not take it.',
    why: 'Prohibition and “just say no” have not stopped drug use. They have left many people without information. Street drugs come with no guarantee of purity or strength, and synthetic opioids and other novel substances are increasingly found in the supply.',
    helps: 'If you might use, it is safer to have someone sober with you who knows what you have taken, to test where you can, and to avoid mixing. Never stop alcohol or benzodiazepines suddenly if you are dependent, because withdrawal can be life-threatening. Speak to a doctor or a drug service about a safe plan. I can help you find services. I cannot advise on doses or tell you what is safe to take.',
  },
  {
    id: 'overdose', title: 'If someone has taken too much (emergency)',
    terms: ['overdose', 'overdosed', 'took too much', 'taken too much', 'someone overdosed', 'not breathing', 'unresponsive', 'wont wake up', "won't wake up", 'passed out', 'alcohol poisoning', 'recovery position', 'naloxone how'],
    what: 'This is an emergency. Call your local emergency number now (999 in the UK, 911 in the US, 112 in much of Europe) and say what has been taken, even if you are not sure. You will not get into legal trouble for asking for emergency help in the UK.',
    why: 'Opioid overdose signs: hard or impossible to wake, slow, shallow or stopped breathing, blue or grey lips or fingertips, tiny pupils, gurgling or snoring sounds.',
    helps: 'While you wait: give naloxone if you have it, following the pack instructions. Put them in the recovery position if they are breathing. Stay with them until help arrives. Start CPR if breathing stops. For alcohol poisoning: do not leave them alone, put them in the recovery position, call the emergency number if you cannot rouse them. For stimulant overdose (very hot, racing heart, fixed wide pupils, paranoia): call emergency services, help them sit and sip water slowly, and reassure them.',
  },
  {
    id: 'shamecycle', title: 'The shame cycle',
    terms: ['shame cycle', 'shame spiral', 'ashamed of myself', 'ashamed of using', 'feel like a failure for using', 'moral failing', 'moral model'],
    what: 'The shame cycle: a person’s needs go unmet; the resulting pain drives them towards escape (a substance, a behaviour, isolation); society blames them; the blame creates more shame; the shame creates more need to escape. Shame acts like poison. The moral model of addiction, which treats addiction as a choice or a character flaw, feeds it.',
    why: 'Neurodivergent people are already carrying shame about who they are, so this cycle can be especially vicious. It is not a sign that you are weak.',
    helps: 'Breaking it means reducing shame and meeting needs: safe housing and money support where possible, trauma-informed care, a support network, and being seen without blame. Talking to a non-judgemental person, or to me, is a step.',
  },
  {
    id: 'eatingdisorders', title: 'Eating differences: ARFID and eating disorders',
    terms: ['arfid', 'eating disorder', 'eating disorders', 'anorexia', 'bulimia', 'binge eating', 'safe foods', 'safe food', 'fussy eater', 'picky eater', 'cant eat', "can't eat", 'food texture', 'food aversion', 'restrictive eating'],
    what: 'Sensory-driven eating differences are very common among Autistic people. ARFID (avoidant/restrictive food intake disorder) is driven by sensory sensitivity, fear of new foods, and preferences for texture, smell or colour rather than body image. Other eating disorders in Autistic people can be driven by the appeal of rules and control, the sensory experience of hunger, or interoceptive differences. Food can also be a stim and a comfort.',
    why: 'Having only a few “safe foods” is about regulation and predictability, not fussiness, and a change in brand or texture can make a food suddenly unsafe. Eating disorders have the highest mortality of any mental health condition, so they deserve proper help.',
    helps: 'Never force it: coercive approaches make things worse. Ask for a clinician who understands both autism and eating disorders, and for gradual, consented approaches such as food chaining and dietitian input. If you are not eating enough or are losing weight quickly, please see a doctor.',
  },
  {
    id: 'anxiety', title: 'Anxiety in neurodivergent people',
    terms: ['anxiety', 'anxious', 'panic attack', 'panic attacks', 'social anxiety', 'health anxiety', 'anticipatory anxiety', 'dread', 'on edge'],
    what: 'Anxiety is very common in Autistic and ADHD people, and hard to separate from neurodivergent traits, because the need for predictability, sensory sensitivity and difficulty with change can all be intensified by anxiety. It can show up as meltdowns or shutdowns after small changes, worry that starts days before an event, exhaustion after social time, avoidance that looks like laziness, and physical sensation (nausea, tight chest) before you notice a feeling.',
    why: 'Much anxiety here comes from a world that is unpredictable and unkind to neurodivergent people, plus a history of social rejection. It is a sensible reaction to real things.',
    helps: 'Changing the environment (less sensory load, more predictability, clear expectations) often helps more than working on thoughts alone. Acceptance and Commitment Therapy (ACT) is often a better fit than standard CBT for many Autistic people. Exposure work must be paced and consensual. Medication may help some people, and it is a decision for you and a prescriber. Grounding and breathing in the Toolkit can help in the moment.',
  },
  {
    id: 'eupd', title: 'EUPD/BPD and misdiagnosis',
    terms: ['eupd', 'bpd', 'borderline', 'borderline personality', 'emotionally unstable', 'personality disorder', 'misdiagnosed', 'misdiagnosis', 'wrong diagnosis', 'diagnosed with bpd'],
    what: 'The NeuroHub guide notes that EUPD/BPD is over-diagnosed in Autistic people, especially Autistic women and people socialised as women, because emotional dysregulation, an unstable sense of self, intense relationships and impulsivity overlap heavily with both Autistic experience and complex PTSD. In many cases, what has been called EUPD is better understood as an Autistic response to a world not designed for Autistic people, made worse by trauma.',
    why: 'An incorrect label can lead to years of treatment that does not fit. David Gray-Hammond himself was misdiagnosed for two years before his autism was recognised.',
    helps: 'If you have an EUPD/BPD diagnosis and have never been assessed for autism or ADHD, it is reasonable to ask for that assessment. A trauma-informed approach matters whichever diagnosis you hold. If you do have it, skills-based therapy such as DBT, adapted for neurodivergent people, has support.',
  },
  {
    id: 'ocdvsautism', title: 'OCD or Autistic routines: what is the difference?',
    terms: ['ocd or autism', 'ocd vs autism', 'compulsions or routines', 'intrusive thoughts distressing', 'erp', 'exposure and response prevention'],
    what: 'The distinction is one of function and feeling. Autistic repetitive behaviours usually feel right, comfortable and self-regulating, and you do them by choice. OCD compulsions usually feel unwanted, driven by distress, and are done to neutralise anxiety, not because they feel good. OCD is genuinely common in Autistic people and also over-diagnosed when Autistic traits are mistaken for compulsions.',
    why: 'Intrusive thoughts can be especially hard for Autistic people to see as “just thoughts”, which can lead to a lot of rumination.',
    helps: 'Look for a clinician who understands both. Exposure and response prevention (ERP) is the standard treatment for OCD but must be adapted: slower, clearly explained and fully consented to, because unmodified ERP can be re-traumatising.',
  },
  {
    id: 'interdependence', title: 'Interdependence and support needs',
    terms: ['interdependence', 'independence', 'need help', 'asking for help', 'dependent on others', 'burden', 'a burden', 'im a burden', "i'm a burden", 'support needs', 'care needs', 'presume competence'],
    what: 'Interdependence means we all depend on each other in sensory, cognitive and social ways. Independence is not the only goal, and needing support does not make you less. Support needs vary across days, settings and skills, and are better described specifically than by a label like “high” or “low” functioning.',
    why: 'Many neurodivergent people feel like a burden because society values people mainly by economic output and independence. That is a value judgement, not a fact about you.',
    helps: 'Say what would help, in specific terms. Build a web of people who can help in different ways, and offer back what you can, in your own way. If you are thinking that others would be better off without you, please use the Help button or talk to someone right now.',
  },
  {
    id: 'authors', title: 'About the books and where to read more',
    terms: ['david gray-hammond', 'gray-hammond', 'gray hammond', 'neurohub', 'neurohub community', 'unashamed autistic', 'restorying autism', 're-storying autism', 'the new normal', 'unusual medicine', 'autism and psychosis', 'six point framework', 'six-point framework', 'who made you', 'who made phoenix', 'who wrote', 'what should i read', 'books', 'reading list', 'recommend a book'],
    what: 'Phoenix was made by NeuroHub Community, an Autistic-led organisation founded by David Gray-Hammond, who is Autistic, ADHD and schizophrenic and in long-term recovery from addiction. Phoenix’s outlook draws on his books: Supporting Autistic People: A Six-Point Framework; Re-Storying Autism (with Helen Edgar); Unashamed Autistic; The New Normal; Unusual Medicine; Autism and Psychosis; and A Brief and Honest Guide to Drugs for Neurodivergent People.',
    why: 'The six-point framework is: understanding Autistic experience; the sensory and emotional landscape; burnout as a crisis of connection; identity, language and disability models; trauma, safety and the emotional environment; and learning from Autistic community.',
    helps: 'You can find the full catalogue at https://mybook.to/dgh-full-catalogue and the community at https://connect.neurohubcommunity.org/p/join . Phoenix is not a substitute for reading real neurodivergent voices, and there are many other Autistic and neurodivergent authors worth following.',
  },
];

/** Which tab of the Learn screen each entry sits under. Entries not listed fall under “More”. */
export const GROUPS = [
  ['Foundations', ['neurodiversity', 'autism', 'adhd', 'audhd', 'dyslexia', 'dyspraxia', 'dyscalculia', 'tourette', 'ocd', 'ocdvsautism', 'identityfirst', 'selfid', 'neuronormativity', 'neuroqueer', 'neurodivergencecompetence', 'authors']],
  ['Body and senses', ['sensory', 'eightsenses', 'interoception', 'alexithymia', 'stimming', 'coregulation', 'nesting', 'sleep', 'eatingdisorders']],
  ['Attention and energy', ['monotropism', 'lilypadding', 'monotropicsplit', 'inertia', 'executive', 'timeblind', 'transitions', 'bodydouble', 'spoons', 'energyaccounting', 'lowdemand', 'pda']],
  ['Burnout and overload', ['burnout', 'atypicalburnout', 'burnoutrecovery', 'burnoutvsdepression', 'meltdown', 'shutdown', 'masking', 'unmasking', 'boundaries']],
  ['Feelings and mental health', ['rsd', 'shame', 'anxiety', 'minoritystress', 'psychosis', 'burnoutpsychosis', 'acquiredneurodivergence', 'eupd', 'medication']],
  ['Relationships and identity', ['doubleempathy', 'ausocial', 'specialinterests', 'glimmers', 'scripting', 'nothingaboutus', 'interdependence']],
  ['Rights and society', ['ableism', 'functioninglabels', 'curecultur']],
  ['Substances and safety', ['substanceuse', 'harmreduction', 'overdose', 'shamecycle']],
];
