# Effeciently Testing Causal Correctness in Pubsub 

Bob's chat window

```
Alice: Shall we invite Carol over?
<<Carol joins>>
Bob: Would you like to come over for dinner?
Carol: Yes! I'll bring desert
```

Carol's Chat Window
```
<<accepts invite>>
Bob: Would you like to come over for dinner?
Carol: Yes! I'll bring desert
```


Example of causal consistency violation from Alice's chat window

```
Alice: Shall we invite Carol over?
<<Carol joins>>
Carol: Yes! I'll bring desert
Bob: Would you like to come over for dinner?
```

We can intuitively spot a causal violation in Carol answering Bob's question before it was asked. Logically it doesn't make sense answering a question before it was asked, but what is really going on here formally?

## Causal Consistency

Casual consistency is defining that X happens before Y, denoted X < Y. 

From Carol's perspective she received a question from Bob as incoming information from the chat app. She then wrote a reply in the chat application. She only wrote that reply **because** she was asked the question. Thus a causal ordering (`<`) is established between these two events
```
"Bob: Would you like to come over for dinner? < Carol: Yes! I'll bring desert"
```

In Alice's chat window she expects to receive messages preserving causal ordering. She is notified of two messages sent by two different people. In general, she can't tell if the messages are out of order, but in this specific case the messages have inferable causal ordering because one is clearly the reply to the other. Thus Alice can tell just from her own timeline that causal consistency has been violated.

By encoding casual ordering dependency information into the messages themselves, we can verify causality has not been violated without complex model checking.

### Casual Consistency Over Multiple Timelines

Each participant (client) experiences events in an order. This is their personal history. In a strictly serialized system this history would need to appear to be the same for all participants, but in a causally consistent system particpants can go offline and catch up later. The main gaurantee in causal consist systems is that things that "happened before" other things are preserved when replaying history, e.g. when getting back online.

So there is not single global history in a causally consistent system, there is an observed history for each client. So we can say client A observes events at `A01 < A02 < A03...`, and client B observes event on its own timeline of steps `B01 < B02 < B03...`. For a system to be causally consistent, there must be a combination of timelines that preserve causal ordering

```
A01 <              < A02 < A03
       B01 < B02                < B03
```


The interesting thing we saw in the Alice example is that she can observe messages in her personal timeline that imply logical assertion of causal dependencies across other people's timelines. We can take that general idea and run with it during automated testing. 

### In-band Logic 

Instead of sending random messages during randomized testing a client can publish data helpful for the test, for example, a useful message is stating its local timestep. Other clients observing that message will then be able to infer a causal relationship between their two timelines.


E.g. if client B, at time T5, observes client A broadcasting "I am at A3", it can deduce A3 < B5 (A3 is sometime before B5). This is informative, but it is not expressive enough to discover the inconsistency in our opening example with Carol. 

If clients also publish their deductions so far, information .

So if client A publishes first then write the time is A1, and because they have made no other observations they don't know anything  know client B and client C are 
```
A1: publish("") 
```

If B receives that message, and its at time B1, B can update its knowledge

```
B1: observe("A1") => 
  A1 < B1 && B2 <= A1  // TODO I CHANGE THE CHAIN RULE
```

Now if B transmits, it encodes all its knowledge in a message

```
B2: publish("A1 < B1 && B0 < A1")
```

If C receives this, it grow its knowledge base upon B's information in the message

```
C1: observe("B1: A1 < B1 && B0 < A1") => 
   B1 < C1 && C0 < B1 && 
   A1 < B1 && B0 < A1
```

By running a chat session between some participants we generate a set of causal relations. Here is what it looks like for our chat app. Let client A be Alice, Client B be Bob and Client C be Carol.

```
// Alice: Shall we invite Carol over?
1 A1: publish ()

// Bobs receives: Alice: Shall we invite Carol over?
2 B1: observe (A1: ) =>
  A1 < B1 && B0 < A1

// Bob: Would you like to come over for dinner?
3 B2: publish ("A1 < B1 && B0 < A1")

// Carol receives: Bob: Would you like to come over for dinner?
4 C1: observe ("B2: A1 < B1 && B0 < A1") => 
  B2 < C1 && C0 < B2 && 
  A1 < B1 && B0 < A1

// Carol: Yes, I'll bring desert
5 C2: publish ("B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1")

// Alice receives: Yes! I'll bring desert
6 A2: observe ("C2: B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1") => 
    C2 < A2 && A1 < C2 && 
    B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1

// Alice receives: Would you like to come over for dinner?
7 A3: observer ("B2: A1 < B1 && B0 < A1") => 
    B2 < A3 && A2 < B2 &&
    A1 < B1 < A2 && B0 < A1 && C0 < A1 && 
    /* A's prior knowledge */ C2 < A2 && A1 < C2 && B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1
```
Now at time 7 we see the causal violation at step A3. The important clauses are
```
"B2 < C1" // @C1 Carol heard bobs questions
"C2 < A2" // @A2 // Alice observed Carol's response
"C1 < C2" // timelines ordering
=> 
  B2 < A2
```
But later
```
"A2 < B2" // @A3 Alice heard bob's question out-of-turn
```

B2 cannot be less than A2 and A2 cannot be less than B2 at the same time! So we have shown a contradiction. The pub system messed up when Alice heard bob's reply, and all the information
was available to do that detection locally to A. However, we had to use symbolic reasoning to figure it out, which is kinda complicated to do.

### Avoiding Symbolic Reasoning

In the special case of a test harness or a single remote authority, we do not need a symbolic reasoner to detect conflicts in the expressions. We can use the known time and substitute it into the timestep variables.

```
let
    A1= 1,
    B1= 2,
    B2= 3,
    C1= 4,
    C2= 5,
    A2= 6,
    A3= 7,
    A0= 0,
    B0= 0,
    C0= 0;
B2 < A3 && A2 < B2 &&
    A1 < B1 < A2 && B0 < A1 && C0 < A1 && C2 < A2 && A1 < C2 && B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1;

> false

```

Note I have been deliberate to express the logic as valid javascript expressions so in a test harness we can use `eval` to check for causal consistency as we go.

### Deduping Clauses

In a circular chat, a participant will receive historical knowledge that they already know. Thus it is more effiencet to represent the knowledge base as `&&` a set of clauses. But using a Set we get deduping for free.








## Operations

Basic actions

1. write(t, v)
1. subscribe(t)

Basic events
1. observe(t, v)



# timeline

```
A = [subscribe("Q"),observe("Q", "A00,B00 < C01"), write("B00,C01 < A3")]
```