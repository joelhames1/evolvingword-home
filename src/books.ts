// The readable books on the shelf. Every text here is in the public domain.
// The short ones live here; the long ones (Dante, Homer, Poe, Khayyám) are
// fetched from public/books/ when first opened, built by scripts/books.mjs.

export interface Piece {
  title: string;
  /** A prose summary before the verse, like Pope's arguments. */
  note?: string;
  text: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  /** The translator, when there is one. */
  by?: string;
  year: string;
  /** A short name for buttons. */
  short?: string;
  /** Spine colors: cloth and lettering. */
  cloth: string;
  ink: string;
  /** Where to fetch the text, for books too long to ship with the page. */
  src?: string;
  pieces: Piece[];
}

/** Fetches a long book's text the first time it's opened. */
export async function loadBook(book: Book): Promise<Book> {
  if (!book.src || book.pieces.length) return book;
  const res = await fetch(book.src);
  if (!res.ok) throw new Error(`Could not load ${book.title}`);
  book.pieces = ((await res.json()) as { pieces: Piece[] }).pieces;
  return book;
}

export const BOOKS: Book[] = [
  { id: 'inferno', title: 'Inferno', short: 'Inferno', author: 'Dante Alighieri', by: 'Henry Wadsworth Longfellow', year: '1867', cloth: '#5e1717', ink: '#e2c27a', src: '/books/inferno.json', pieces: [] },
  { id: 'purgatorio', title: 'Purgatorio', short: 'Purgatorio', author: 'Dante Alighieri', by: 'Henry Wadsworth Longfellow', year: '1867', cloth: '#5e1717', ink: '#e2c27a', src: '/books/purgatorio.json', pieces: [] },
  { id: 'paradiso', title: 'Paradiso', short: 'Paradiso', author: 'Dante Alighieri', by: 'Henry Wadsworth Longfellow', year: '1867', cloth: '#5e1717', ink: '#e2c27a', src: '/books/paradiso.json', pieces: [] },
  { id: 'odyssey', title: 'The Odyssey', short: 'Odyssey', author: 'Homer', by: 'Alexander Pope', year: '1726', cloth: '#1d3550', ink: '#e6d4a0', src: '/books/odyssey.json', pieces: [] },
  { id: 'poe', title: 'The Bells and Other Poems', short: 'Poe', author: 'Edgar Allan Poe', year: '1827 to 1849', cloth: '#16161a', ink: '#c9ccd2', src: '/books/poe.json', pieces: [] },
  { id: 'rubaiyat', title: 'Rubáiyát of Omar Khayyám', short: 'Rubáiyát', author: 'Omar Khayyám', by: 'Edward FitzGerald', year: '1889', cloth: '#6b4a1e', ink: '#f0d690', src: '/books/rubaiyat.json', pieces: [] },
  {
    id: 'sonnets',
    short: 'Sonnets',
    title: 'Sonnets',
    author: 'William Shakespeare',
    year: '1609',
    cloth: '#5b1f2a',
    ink: '#e8cf8a',
    pieces: [
      {
        title: 'XVIII',
        text: `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date;
Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance or nature's changing course untrimm'd;
But thy eternal summer shall not fade,
Nor lose possession of that fair thou ow'st;
Nor shall Death brag thou wander'st in his shade,
When in eternal lines to time thou grow'st:
   So long as men can breathe or eyes can see,
   So long lives this, and this gives life to thee.`,
      },
      {
        title: 'XXIX',
        text: `When, in disgrace with fortune and men's eyes,
I all alone beweep my outcast state,
And trouble deaf heaven with my bootless cries,
And look upon myself and curse my fate,
Wishing me like to one more rich in hope,
Featur'd like him, like him with friends possess'd,
Desiring this man's art and that man's scope,
With what I most enjoy contented least;
Yet in these thoughts myself almost despising,
Haply I think on thee, and then my state,
Like to the lark at break of day arising
From sullen earth, sings hymns at heaven's gate;
   For thy sweet love remember'd such wealth brings
   That then I scorn to change my state with kings.`,
      },
      {
        title: 'LXXIII',
        text: `That time of year thou mayst in me behold
When yellow leaves, or none, or few, do hang
Upon those boughs which shake against the cold,
Bare ruin'd choirs, where late the sweet birds sang.
In me thou see'st the twilight of such day
As after sunset fadeth in the west,
Which by and by black night doth take away,
Death's second self, that seals up all in rest.
In me thou see'st the glowing of such fire
That on the ashes of his youth doth lie,
As the death-bed whereon it must expire,
Consum'd with that which it was nourish'd by.
   This thou perceiv'st, which makes thy love more strong,
   To love that well which thou must leave ere long.`,
      },
      {
        title: 'CXVI',
        text: `Let me not to the marriage of true minds
Admit impediments. Love is not love
Which alters when it alteration finds,
Or bends with the remover to remove.
O no! it is an ever-fixed mark
That looks on tempests and is never shaken;
It is the star to every wand'ring bark,
Whose worth's unknown, although his height be taken.
Love's not Time's fool, though rosy lips and cheeks
Within his bending sickle's compass come;
Love alters not with his brief hours and weeks,
But bears it out even to the edge of doom.
   If this be error and upon me prov'd,
   I never writ, nor no man ever lov'd.`,
      },
    ],
  },
  {
    id: 'dickinson',
    short: 'Dickinson',
    title: 'Poems',
    author: 'Emily Dickinson',
    year: '1890',
    cloth: '#e6dcc4',
    ink: '#4a5a3a',
    pieces: [
      {
        title: '"Hope" is the thing with feathers',
        text: `"Hope" is the thing with feathers –
That perches in the soul –
And sings the tune without the words –
And never stops – at all –

And sweetest – in the Gale – is heard –
And sore must be the storm –
That could abash the little Bird
That kept so many warm –

I've heard it in the chillest land –
And on the strangest Sea –
Yet – never – in Extremity,
It asked a crumb – of me.`,
      },
      {
        title: "I'm Nobody! Who are you?",
        text: `I'm Nobody! Who are you?
Are you – Nobody – too?
Then there's a pair of us!
Don't tell! they'd advertise – you know!

How dreary – to be – Somebody!
How public – like a Frog –
To tell one's name – the livelong June –
To an admiring Bog!`,
      },
      {
        title: 'Because I could not stop for Death',
        text: `Because I could not stop for Death –
He kindly stopped for me –
The Carriage held but just Ourselves –
And Immortality.

We slowly drove – He knew no haste
And I had put away
My labor and my leisure too,
For His Civility –

We passed the School, where Children strove
At Recess – in the Ring –
We passed the Fields of Gazing Grain –
We passed the Setting Sun –

Or rather – He passed Us –
The Dews drew quivering and Chill –
For only Gossamer, my Gown –
My Tippet – only Tulle –

We paused before a House that seemed
A Swelling of the Ground –
The Roof was scarcely visible –
The Cornice – in the Ground –

Since then – 'tis Centuries – and yet
Feels shorter than the Day
I first surmised the Horses' Heads
Were toward Eternity –`,
      },
    ],
  },
  {
    id: 'frost',
    short: 'Frost',
    title: 'Mountain Interval & Other Poems',
    author: 'Robert Frost',
    year: '1916 to 1923',
    cloth: '#2d4a3a',
    ink: '#e8e1cc',
    pieces: [
      {
        title: 'Stopping by Woods on a Snowy Evening',
        text: `Whose woods these are I think I know.
His house is in the village though;
He will not see me stopping here
To watch his woods fill up with snow.

My little horse must think it queer
To stop without a farmhouse near
Between the woods and frozen lake
The darkest evening of the year.

He gives his harness bells a shake
To ask if there is some mistake.
The only other sound's the sweep
Of easy wind and downy flake.

The woods are lovely, dark and deep,
But I have promises to keep,
And miles to go before I sleep,
And miles to go before I sleep.`,
      },
      {
        title: 'The Road Not Taken',
        text: `Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;

Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear;
Though as for that the passing there
Had worn them really about the same,

And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.

I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I –
I took the one less traveled by,
And that has made all the difference.`,
      },
      {
        title: 'Nothing Gold Can Stay',
        text: `Nature's first green is gold,
Her hardest hue to hold.
Her early leaf's a flower;
But only so an hour.
Then leaf subsides to leaf.
So Eden sank to grief,
So dawn goes down to day.
Nothing gold can stay.`,
      },
      {
        title: 'Fire and Ice',
        text: `Some say the world will end in fire,
Some say in ice.
From what I've tasted of desire
I hold with those who favor fire.
But if it had to perish twice,
I think I know enough of hate
To say that for destruction ice
Is also great
And would suffice.`,
      },
    ],
  },
  {
    id: 'whitman',
    short: 'Whitman',
    title: 'Leaves of Grass',
    author: 'Walt Whitman',
    year: '1855 to 1892',
    cloth: '#3f5a2a',
    ink: '#e9d9a0',
    pieces: [
      {
        title: 'from Song of Myself, 1',
        text: `I celebrate myself, and sing myself,
And what I assume you shall assume,
For every atom belonging to me as good belongs to you.

I loafe and invite my soul,
I lean and loafe at my ease observing a spear of summer grass.`,
      },
      {
        title: "When I Heard the Learn'd Astronomer",
        text: `When I heard the learn'd astronomer,
When the proofs, the figures, were ranged in columns before me,
When I was shown the charts and diagrams, to add, divide, and measure them,
When I sitting heard the astronomer where he lectured with much applause in the lecture-room,
How soon unaccountable I became tired and sick,
Till rising and gliding out I wander'd off by myself,
In the mystical moist night-air, and from time to time,
Look'd up in perfect silence at the stars.`,
      },
      {
        title: 'O Me! O Life!',
        text: `Oh me! Oh life! of the questions of these recurring,
Of the endless trains of the faithless, of cities fill'd with the foolish,
Of myself forever reproaching myself, (for who more foolish than I, and who more faithless?)
Of eyes that vainly crave the light, of the objects mean, of the struggle ever renew'd,
Of the poor results of all, of the plodding and sordid crowds I see around me,
Of the empty and useless years of the rest, with the rest me intertwined,
The question, O me! so sad, recurring – What good amid these, O me, O life?

Answer.
That you are here – that life exists and identity,
That the powerful play goes on, and you may contribute a verse.`,
      },
      {
        title: 'from Song of Myself, 52',
        text: `The spotted hawk swoops by and accuses me, he complains of my gab and my loitering.

I too am not a bit tamed, I too am untranslatable,
I sound my barbaric yawp over the roofs of the world.

The last scud of day holds back for me,
It flings my likeness after the rest and true as any on the shadow'd wilds,
It coaxes me to the vapor and the dusk.

I depart as air, I shake my white locks at the runaway sun,
I effuse my flesh in eddies, and drift it in lacy jags.

I bequeath myself to the dirt to grow from the grass I love,
If you want me again look for me under your boot-soles.

You will hardly know who I am or what I mean,
But I shall be good health to you nevertheless,
And filter and fibre your blood.

Failing to fetch me at first keep encouraged,
Missing me one place search another,
I stop somewhere waiting for you.`,
      },
    ],
  },
  {
    id: 'romantics',
    short: 'Romantics',
    title: 'The Romantics',
    author: 'Wordsworth, Keats, Shelley, Blake',
    year: '1794 to 1819',
    cloth: '#1f2f5a',
    ink: '#d9c27a',
    pieces: [
      {
        title: 'I Wandered Lonely as a Cloud · William Wordsworth',
        text: `I wandered lonely as a cloud
That floats on high o'er vales and hills,
When all at once I saw a crowd,
A host, of golden daffodils;
Beside the lake, beneath the trees,
Fluttering and dancing in the breeze.

Continuous as the stars that shine
And twinkle on the milky way,
They stretched in never-ending line
Along the margin of a bay:
Ten thousand saw I at a glance,
Tossing their heads in sprightly dance.

The waves beside them danced; but they
Out-did the sparkling waves in glee:
A poet could not but be gay,
In such a jocund company:
I gazed – and gazed – but little thought
What wealth the show to me had brought:

For oft, when on my couch I lie
In vacant or in pensive mood,
They flash upon that inward eye
Which is the bliss of solitude;
And then my heart with pleasure fills,
And dances with the daffodils.`,
      },
      {
        title: 'Bright Star · John Keats',
        text: `Bright star, would I were stedfast as thou art –
Not in lone splendour hung aloft the night
And watching, with eternal lids apart,
Like nature's patient, sleepless Eremite,
The moving waters at their priestlike task
Of pure ablution round earth's human shores,
Or gazing on the new soft-fallen mask
Of snow upon the mountains and the moors –
No – yet still stedfast, still unchangeable,
Pillow'd upon my fair love's ripening breast,
To feel for ever its soft fall and swell,
Awake for ever in a sweet unrest,
Still, still to hear her tender-taken breath,
And so live ever – or else swoon to death.`,
      },
      {
        title: 'Ozymandias · Percy Bysshe Shelley',
        text: `I met a traveller from an antique land,
Who said – "Two vast and trunkless legs of stone
Stand in the desert. . . . Near them, on the sand,
Half sunk a shattered visage lies, whose frown,
And wrinkled lip, and sneer of cold command,
Tell that its sculptor well those passions read
Which yet survive, stamped on these lifeless things,
The hand that mocked them, and the heart that fed;
And on the pedestal, these words appear:
My name is Ozymandias, King of Kings;
Look on my Works, ye Mighty, and despair!
Nothing beside remains. Round the decay
Of that colossal Wreck, boundless and bare
The lone and level sands stretch far away."`,
      },
      {
        title: 'The Tyger · William Blake',
        text: `Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?

In what distant deeps or skies,
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand, dare seize the fire?

And what shoulder, & what art,
Could twist the sinews of thy heart?
And when thy heart began to beat,
What dread hand? & what dread feet?

What the hammer? what the chain,
In what furnace was thy brain?
What the anvil? what dread grasp,
Dare its deadly terrors clasp!

When the stars threw down their spears
And water'd heaven with their tears:
Did he smile his work to see?
Did he who made the Lamb make thee?

Tyger Tyger burning bright,
In the forests of the night:
What immortal hand or eye,
Dare frame thy fearful symmetry?`,
      },
    ],
  },
  {
    id: 'yeats',
    short: 'Yeats',
    title: 'Early Poems',
    author: 'W. B. Yeats',
    year: '1890 to 1899',
    cloth: '#6a4a1f',
    ink: '#f0e2b8',
    pieces: [
      {
        title: 'The Lake Isle of Innisfree',
        text: `I will arise and go now, and go to Innisfree,
And a small cabin build there, of clay and wattles made;
Nine bean-rows will I have there, a hive for the honey-bee,
And live alone in the bee-loud glade.

And I shall have some peace there, for peace comes dropping slow,
Dropping from the veils of the morning to where the cricket sings;
There midnight's all a glimmer, and noon a purple glow,
And evening full of the linnet's wings.

I will arise and go now, for always night and day
I hear lake water lapping with low sounds by the shore;
While I stand on the roadway, or on the pavements grey,
I hear it in the deep heart's core.`,
      },
      {
        title: 'When You Are Old',
        text: `When you are old and grey and full of sleep,
And nodding by the fire, take down this book,
And slowly read, and dream of the soft look
Your eyes had once, and of their shadows deep;

How many loved your moments of glad grace,
And loved your beauty with love false or true,
But one man loved the pilgrim soul in you,
And loved the sorrows of your changing face;

And bending down beside the glowing bars,
Murmur, a little sadly, how Love fled
And paced upon the mountains overhead
And hid his face amid a crowd of stars.`,
      },
      {
        title: 'He Wishes for the Cloths of Heaven',
        text: `Had I the heavens' embroidered cloths,
Enwrought with golden and silver light,
The blue and the dim and the dark cloths
Of night and light and the half-light,
I would spread the cloths under your feet:
But I, being poor, have only my dreams;
I have spread my dreams under your feet;
Tread softly because you tread on my dreams.`,
      },
    ],
  },
  {
    id: 'walden',
    short: 'Walden',
    title: 'Walden',
    author: 'Henry David Thoreau',
    year: '1854',
    cloth: '#2a3a4a',
    ink: '#e0d6bc',
    pieces: [
      {
        title: 'Where I Lived, and What I Lived For',
        text: `I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life.

Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand.

Time is but the stream I go a-fishing in. I drink at it; but while I drink I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains.`,
      },
    ],
  },
];
