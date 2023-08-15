# Encoding Causal Dependencies

Bob's chat window

```
Alice: Shall we invite Carol over?
<<Carol joins>>
Bob: Would you like to come over for dinner?
Carol: Awesome I'll bring desert
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

We can intuitively spot a causal violation in Carol answering Bob's question before it was asked. Logically it doesn't make sense answering a question before it was asked, but think about what is really going on here.

From Carol's perspective she received a question from Bob as incoming information from the chat app unprompted. She then wrote a reply in the chat application. She only wrote that reply **because** she was asked the question. Thus a causal ordering (`<`) is established between these two events
```
"Bob: Would you like to come over for dinner? < Carol: Yes! I'll bring desert"
```

In Alice's chat window she expects to receive messages preserving causal ordering. She is notified of two messages sent by two different people. In general, she can't tell if the messages are out of order, but in this specific case the messages have inferable causal ordering because one is clearly the reply to the other. Thus Alice can tell just from her own timeline that causal consistency has been violated.

By encoding casual ordering dependency information into the messages themselves, we can verify causality has not been violated without complex model checking.

### section

Each participant (client) experiences a sequence of events in an order. This is their personal history. In a strictly serialized system this history would need to appear to be the same for all participants, but in a causally consistent system particpants can go offline and catch up later. The main gaurantee in causal consist systems is that things that "happened before" other things are preserved when replaying history.

So there is not single global history in a causally consistent system, there is an observed history for each client. So we can say client A has observes events at `A01 < A02 < A03...`, and client B observes event on its own timeline of steps `B01 < B02 < B03...`. For a system to be causally consistent, there must be a combination of timelines that preserve causal ordering

```
A01 <              < A02 < A03
       B01 < B02                < B03
```


The interesting thing we saw in the Alice example is that she can observe messages in her personal timeline that imply logical assertion of causal dependencies across other timelines. We can take that general idea and run with it during automated testing. 







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