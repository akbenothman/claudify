@ Professor Mo (replaces Professor Birch).
@ He talks about his drink of the day, he's always hungry for crazy fries with fluffy sauce and other
@ wild food, and he wants his Pokémon to get along, but his Omar and Ahmed keep fighting.
@
@ Each "@@ file:" line says which game file the blocks below it replace. Every block replaces the block
@ with the same label in that file. Keep lines to about 35 characters: \n starts the second line of a
@ box, \l scrolls to a new line, \p starts a new box, $ ends the text.

@@ file: data/text/birch_speech.inc

gText_Birch_Welcome::
	.string "Hi! Sorry to keep you waiting!\p"
	.string "I was grabbing my drink of the day.\n"
	.string "Mango smoothie. Triple mango.\p"
	.string "Welcome to the world of POKéMON!\p"
	.string "My name is MO.\p"
	.string "But everyone calls me\n"
	.string "PROFESSOR MO.\p"
	.string "$"

gText_Birch_MainSpeech::
	.string "This is my OMAR.\p"
	.string "Normally my AHMED would be here too,\n"
	.string "but those two keep fighting.\l"
	.string "So AHMED's in a time-out.\p"
	.string "All I want is for my POKéMON to\n"
	.string "get along! Is that so much to ask?\p"
	.string "Anyway! This world is widely\n"
	.string "inhabited by creatures known\l"
	.string "as POKéMON.\p"
	.string "We humans live alongside POKéMON,\n"
	.string "at times as friendly playmates, and\l"
	.string "at times as cooperative workmates.\p"
	.string "And sometimes, we band together\n"
	.string "and battle others like us.\p"
	.string "I study POKéMON to unravel their\n"
	.string "mysteries. That's what I do.\p"
	.string "Well, that and eat. I would do\n"
	.string "anything for CRAZY FRIES with\l"
	.string "FLUFFY SAUCE right now.\p"
	.string "$"

gText_Birch_AreYouReady::
	.string "All right, are you ready?\p"
	.string "Your very own adventure is about\n"
	.string "to unfold.\p"
	.string "Take courage, and leap into the\n"
	.string "world of POKéMON where dreams,\l"
	.string "adventure, and friendships await!\p"
	.string "Well, I'll be expecting you later.\n"
	.string "Come see me in my POKéMON LAB.\p"
	.string "And if you pass a food truck on\n"
	.string "the way… bring me some fries!\p"
	.string "$"

@@ file: data/maps/Route101/scripts.inc

Route101_Text_YouSavedMe:
	.string "PROF. MO: Whew…\p"
	.string "I was out here sipping an iced\n"
	.string "matcha, studying wild POKéMON,\l"
	.string "when I got jumped!\p"
	.string "I spilled my drink.\n"
	.string "The WHOLE drink!\p"
	.string "You saved me.\n"
	.string "Thanks a lot!\p"
	.string "Oh?\p"
	.string "Hi, you're {PLAYER}{KUN}!\p"
	.string "This is not the place to chat, so\n"
	.string "come by my POKéMON LAB later, okay?$"

@@ file: data/maps/LittlerootTown_ProfessorBirchsLab/scripts.inc

LittlerootTown_ProfessorBirchsLab_Text_BirchAwayOnFieldwork:
	.string "Hunh? PROF. MO?\p"
	.string "The PROF's out on fieldwork.\n"
	.string "Or he's out looking for food.\l"
	.string "Honestly, it's usually food.\p"
	.string "He says the best research happens\n"
	.string "in the field. Next to a food truck.$"

LittlerootTown_ProfessorBirchsLab_Text_BirchIsntOneForDeskWork:
	.string "The PROF isn't one for desk work.\p"
	.string "Today he left to find a pickle\n"
	.string "pizza he saw online.$"

LittlerootTown_ProfessorBirchsLab_Text_BirchEnjoysRivalsHelpToo:
	.string "PROF. MO studies how POKéMON live\n"
	.string "and how they get along.\p"
	.string "Mostly how his OMAR and AHMED\n"
	.string "don't get along.$"

LittlerootTown_ProfessorBirchsLab_Text_LikeYouToHavePokemon:
	.string "PROF. MO: So, {PLAYER}{KUN}.\p"
	.string "I've heard so much about you from\n"
	.string "your father.\p"
	.string "One second… …slurp…\n"
	.string "Ahh. Strawberry milk.\l"
	.string "Today's drink of the day.\p"
	.string "Anyway! The way you battled earlier,\n"
	.string "you pulled it off with aplomb!\p"
	.string "I guess you have your father's blood\n"
	.string "in your veins after all!\p"
	.string "As thanks for rescuing me, I'd like\n"
	.string "you to have the POKéMON you used\l"
	.string "earlier.\p"
	.string "Just promise me you'll teach it to\n"
	.string "get along with others. Unlike my\l"
	.string "OMAR and AHMED…\p"
	.string "{PLAYER} received the {STR_VAR_1}!$"

LittlerootTown_ProfessorBirchsLab_Text_MightBeGoodIdeaToGoSeeRival:
	.string "PROF. MO: If you work at POKéMON\n"
	.string "and gain experience, I think you'll\l"
	.string "make an extremely good TRAINER.\p"
	.string "My assistant, HAMZA, is studying\n"
	.string "POKéMON while helping me out.\p"
	.string "And if you see a CRAZY FRIES stand\n"
	.string "on the way, you know where I'll be.\p"
	.string "{PLAYER}{KUN}, don't you think it might be\n"
	.string "a good idea to go see {RIVAL}?$"

LittlerootTown_ProfessorBirchsLab_Text_HeardYouBeatRivalTakePokedex:
	.string "PROF. MO: Oh, hi, {PLAYER}{KUN}!\p"
	.string "I heard you beat {RIVAL} on\n"
	.string "your first try. That's excellent!\p"
	.string "I celebrated with a double-chocolate\n"
	.string "milkshake. Okay, two milkshakes.\p"
	.string "Here, {PLAYER}{KUN}, I ordered this for my\n"
	.string "research, but I think you should have\l"
	.string "this POKéDEX.$"

LittlerootTown_ProfessorBirchsLab_Text_CountlessPokemonAwait:
	.string "PROF. MO: Countless POKéMON\n"
	.string "await you!\p"
	.string "Argh, all this talk is making me\n"
	.string "hungry. Fries… FLUFFY SAUCE…\p"
	.string "I need to get out there again!$"

LittlerootTown_ProfessorBirchsLab_Text_GrassyPatchWaiting2:
	.string "PROF. MO: But listen.\n"
	.string "You've become the CHAMPION,\l"
	.string "but your POKéMON journey isn't over.\p"
	.string "There is no end to the road\n"
	.string "that is POKéMON.\p"
	.string "And there's no end to good food,\n"
	.string "either! Let's celebrate.\p"
	.string "CRAZY FRIES, extra FLUFFY SAUCE.\n"
	.string "My treat!$"
