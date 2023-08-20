# Checking Causal Consistency the Easy Way

Streaming infrastruture has fairly clear semantics: "send the messages to the recipients in the order they were written".
And yet, this starts to get complicated as advanced features are added.

- Multiplayer? well now you have to consider merging queues and multiple timelines
- Optimistic updates? Well now local writes have a different pathway.
- Mobile-first? Well clients connectivity is unreliable, so you need transparent resumption
- Local-first? well now some participants messages are buffered and delayed for days

Still, there is an intuitive notion of ordering that is preserved even under these use cases: causal consistency.
Most advanced features are transparent to the messaging user. They use the same SDK, but the path of the messages through the system changes. So you need a way to 
verify the API semantics are correct externally just from SDK usage experiments. 


Verifying causal consistency is quite tricky in general ([NP-Complete](https://arxiv.org/abs/1611.00580#:~:text=Causal%20consistency%20is%20one%20of,according%20to%20their%20causal%20precedence.) infact!), but I consider randomized property checking central to building a robust messaging system. Here I explain a low complexity technique that avoids model checking that makes good use of `eval`, implemented in <100 lines of Typescript.

### Reading

"Time, Clocks, and the Ordering of Events in a Distributed System" by Leslie Lamport, the daddy paper of causal consistency that introduced the relation "happens-before" is a way that scales to multiple timelines. Not the easiest introduction.

[Causal Consistency - Jepsen blog](https://jepsen.io/consistency/models/causal#:~:text=Causal%20consistency%20captures%20the%20notion,order%20of%20causally%20independent%20operations.)


## Example

### Bob's Chat Window

```
Alice: Shall we invite Carol over?
<<Carol joins>>
Bob: Would you like to come over for dinner?
Carol: Yes! I'll bring dessert
```

### Carol's Chat Window

```
<<accepts invite>>
Bob: Would you like to come over for dinner?
Carol: Yes! I'll bring dessert
```

### Example of Causal Consistency Violation from Alice's Chat Window

```
Alice: Shall we invite Carol over?
<<Carol joins>>
Carol: Yes! I'll bring dessert
Bob: Would you like to come over for dinner?
```

We can intuitively spot a causal violation in Carol answering Bob's question before it was asked. Logically it doesn't make sense to answer a question before it was asked, but what is really going on here formally?

## Causal Consistency

Causal consistency is defined as ensuring that event X happens before event Y, denoted as \(X < Y\).

From Carol's perspective, she received a question from Bob as incoming information from the chat app. She then wrote a reply in the chat application. She only wrote that reply **because** she was asked the question. Thus, a causal ordering (`<`) is established between these two events:

```
"Bob: Would you like to come over for dinner? < Carol: Yes! I'll bring dessert"
```

In Alice's chat window, she expects to receive messages preserving causal ordering. She is notified of two messages sent by two different people. In general, she can't tell if the messages are out of order, but in this specific case, the messages have inferable causal ordering because one is clearly the reply to the other. Thus, Alice can tell just from her own timeline that causal consistency has been violated.

By encoding causal ordering dependency information into the messages themselves, we can verify causality has not been violated without complex model checking.

### Causal Consistency Over Multiple Timelines

Each participant (client) experiences events in an order. This is their personal history. In a strictly serialized system, this history would need to appear the same for all participants. But in a causally consistent system, participants can go offline and catch up later. The main guarantee in causally consistent systems is that things that "happened before" other things are preserved when replaying history, e.g., when getting back online.

So there is not a single global history in a causally consistent system; there is an observed history for each client. We can say client A observes events at `A01 < A02 < A03...`, and client B observes events on its own timeline of steps `B01 < B02 < B03...`. For a system to be causally consistent, there must be a combination of timelines that preserve causal ordering:

```
A01 <              < A02 < A03
       B01 < B02                < B03
```

### In-Band Logic 

Instead of sending random messages during randomized testing, a client can publish data helpful for the test. For example, a useful message is stating its local timestep. Other clients observing that message will then be able to infer a causal relationship between their two timelines.

E.g., if client B, at time T5, observes client A broadcasting "I am at A3," it can deduce \( A3 < B5 \) (A3 is sometime before B5). This is informative but not expressive enough to discover the inconsistency in our opening example with Carol.

By running a chat session between some participants, we generate a set of causal relations. Here's what it looks like for our chat app:

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

// Carol: Yes, I'll bring dessert
5 C2: publish ("B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1")

// Alice receives: Yes! I'll bring dessert
6 A2: observe ("C2: B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1") => 
    C2 < A2 && A1 < C2 && 
    B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1

// Alice receives: Would you like to come over for dinner?
7 A3: observe ("B2: A1 < B1 && B0 < A1") => 
    B2 < A3 && A2 < B2 &&
    A1 < B1 < A2 && B0 < A1 && C0 < A1 && 
    /* A's prior knowledge */ C2 < A2 && A1 < C2 && B2 < C1 && C0 < B2 && A1 < B1 && B0 < A1
```

Now, at time 7, we see the causal violation at step A3. The important clauses are:

```
"B2 < C1" // @C1 Carol heard Bob's question
"C2 < A2" // @A2 // Alice observed Carol's response
"C1 < C2" // timelines ordering
=> 
  B2 < A2
```

But later:

```
"A2 < B2" // @A3 Alice heard Bob's question out-of-turn
```

\( B2 \) cannot be less than \( A2 \), and \( A2 \) cannot be less than \( B2 \) at the same time! So we have shown a contradiction. The system messed up when Alice heard Bob's reply, and all the information was available to detect that locally to A. However, we had to use symbolic reasoning to figure it out, which can be complicated.

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
    A1 < B1 < A2 && B0 < A1 && C0 < A1 && C2 < A2 && A