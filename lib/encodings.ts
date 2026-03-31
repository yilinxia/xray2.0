// ASP/Datalog encodings for argumentation semantics
// Source: https://www.dbai.tuwien.ac.at/research/argumentation/aspartix/dung.html

export const GROUNDED_ENCODING_SIMPLE = `% https://www.dbai.tuwien.ac.at/research/argumentation/aspartix/dung.html

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Encoding for grounded extensions
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% For the remaining part we need to put an order on the domain.
% Therefore, we define a successor-relation with infinum and supremum
% as follows
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

lt(X,Y) :- arg(X),arg(Y), X<Y.
nsucc(X,Z) :- lt(X,Y), lt(Y,Z).
succ(X,Y) :- lt(X,Y), not nsucc(X,Y).
ninf(X) :- lt(Y,X).
nsup(X) :- lt(X,Y).
inf(X) :- not ninf(X), arg(X).
sup(X) :- not nsup(X), arg(X).

%% we now fill up the predicate in(.) with arguments which are defended

defended_upto(X,Y) :- inf(Y), arg(X), not att(Y,X).
defended_upto(X,Y) :- inf(Y), in(Z), att(Z,Y), att(Y,X).
defended_upto(X,Y) :- succ(Z,Y), defended_upto(X,Z), not att(Y,X).
defended_upto(X,Y) :- succ(Z,Y), defended_upto(X,Z), in(V), att(V,Y), att(Y,X).

defended(X) :- sup(Y), defended_upto(X,Y).
in(X) :- defended(X).
`

export const STABLE_ENCODING = `% https://www.dbai.tuwien.ac.at/research/argumentation/aspartix/dung.html

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Encoding for stable extensions
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% Guess a set S \\subseteq A
in(X) :- not out(X), arg(X).
out(X) :- not in(X), arg(X).

%% S has to be conflict-free
:- in(X), in(Y), att(X,Y).

%% The argument x is defeated by the set S
defeated(X) :- in(Y), att(Y,X).

%% S defeats all arguments which do not belong to S
:- out(X), not defeated(X).
`

export const PREFERRED_ENCODING = `% https://www.dbai.tuwien.ac.at/research/argumentation/aspartix/dung.html

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Encoding for preferred extensions
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Guess a set S \\subseteq A
in(X) :- not out(X), arg(X).
out(X) :- not in(X), arg(X).

%% S has to be conflict-free
:- in(X), in(Y), att(X,Y).

%% The argument x is defeated by the set S
defeated(X) :- in(Y), att(Y,X).

%% The argument x is not defended by S
not_defended(X) :- att(Y,X), not defeated(Y).

%% All arguments x \\in S need to be defended by S (admissibility)
:- in(X), not_defended(X).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% For the remaining part we need to put an order on the domain.
% Therefore, we define a successor-relation with infinum and supremum
% as follows
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

lt(X,Y) :- arg(X),arg(Y), X<Y.
nsucc(X,Z) :- lt(X,Y), lt(Y,Z).
succ(X,Y) :- lt(X,Y), not nsucc(X,Y).
ninf(X) :- lt(Y,X).
nsup(X) :- lt(X,Y).
inf(X) :- not ninf(X), arg(X).
sup(X) :- not nsup(X), arg(X).


%% Guess S' \\supseteq S
inN(X) :- in(X).
inN(X) | outN(X) :- out(X).

%% If S' = S then spoil.
%% Use the sucessor function and check starting from supremum whether
%% elements in S' is also in S. If this is not the case we "stop"
%% If we reach the supremum we spoil up.

% eq indicates whether a guess for S' is equal to the guess for S

eq_upto(Y) :- inf(Y), in(Y), inN(Y).
eq_upto(Y) :- inf(Y), out(Y), outN(Y).

eq_upto(Y) :- succ(Z,Y), in(Y), inN(Y), eq_upto(Z).
eq_upto(Y) :- succ(Z,Y), out(Y), outN(Y), eq_upto(Z).

eq :- sup(Y), eq_upto(Y).


%% get those X \\notin S' which are not defeated by S'
%% using successor again...

undefeated_upto(X,Y) :- inf(Y), outN(X), outN(Y).
undefeated_upto(X,Y) :- inf(Y), outN(X),  not att(Y,X).

undefeated_upto(X,Y) :- succ(Z,Y), undefeated_upto(X,Z), outN(Y).
undefeated_upto(X,Y) :- succ(Z,Y), undefeated_upto(X,Z), not att(Y,X).

undefeated(X) :- sup(Y), undefeated_upto(X,Y).

%% spoil if the AF is empty
not_empty :- arg(X).
spoil :- not not_empty.

%% spoil if S' equals S for all preferred extensions
spoil :- eq.

%% S' has to be conflict-free - otherwise spoil
spoil :- inN(X), inN(Y), att(X,Y).

%% S' has to be admissible - otherwise spoil
spoil :- inN(X), outN(Y), att(Y,X), undefeated(Y).

inN(X) :- spoil, arg(X).
outN(X) :- spoil, arg(X).

%% do the final spoil-thing ...
:- not spoil.


%in(X)?
#show in/1.
`

export const COMPLETE_ENCODING = `% https://www.dbai.tuwien.ac.at/research/argumentation/aspartix/dung.html

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Encoding for complete extensions
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Guess a set S \\subseteq A
in(X) :- not out(X), arg(X).
out(X) :- not in(X), arg(X).

%% S has to be conflict-free
:- in(X), in(Y), att(X,Y).

%% The argument x is defeated by the set S
defeated(X) :- in(Y), att(Y,X).

%% The argument x is not defended by S
not_defended(X) :- att(Y,X), not defeated(Y).

%% admissible
:- in(X), not_defended(X).

%% Every argument which is defended by S belongs to S
:- out(X), not not_defended(X).
`

export const ADMISSIBLE_ENCODING = `% https://www.dbai.tuwien.ac.at/research/argumentation/aspartix/dung.html

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Encoding for admissible extensions
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% Guess a set S \\subseteq A
in(X) :- not out(X), arg(X).
out(X) :- not in(X), arg(X).

%% S has to be conflict-free
:- in(X), in(Y), att(X,Y).

%% The argument x is defeated by the set S
defeated(X) :- in(Y), att(Y,X).

%% The argument x is not defended by S
not_defended(X) :- att(Y,X), not defeated(Y).

%% All arguments x \\in S need to be defended by S
:- in(X), not_defended(X).
`

export const LENGTH_CAL_ENCODING = `#const state_max = 100.

% Define pos from attack relations
pos(X) :- attack(X,_).
pos(X) :- attack(_,X).

% win-e rule in "doubled form" (2 rounds for 1, simplifying queries & termination)
win_o(S, X) :- attack(Y,X), not win_u(S,Y), next(S,_).  % (1)
win_u(S1,X) :- attack(Y,X), not win_o(S,Y), next(S,S1). % (2)

% First-Green: when was a win_u first derived?
fg(S1,X) :- next(S,S1), not win_u(S,X), win_u(S1,X).  % (3)

% First-Red: when did a loss first drop from win_o?
fr(0,X)  :- pos(X), not win_o(0,X).
fr(S1,X) :- next(S,S1), not final(S), win_o(S,X), not win_o(S1,X). % (4)

% (5) Generating new states, as long as necessary
next(0,1).
next(S,S1) :- fg(S,X), S1 = S+1, S < state_max.                       % (5)

% Using clingo's "_" semantics to obtain final state (second last)
final(S) :- next(S,S1), not next(S1,_). % not \\exists _ .. % (6)

% (7,8,9) Solutions (position values) calculation with length
len(accepted,X,L) :- fr(S,X), L = 2*S.   % Two plies = one e:  len = 0,2,4, ..
len(defeated,X,L) :- fg(S,X), L = 2*S-1. % Green is 1 ply behind: len = 1,3,5, ..
len(undefined,X,infinity) :- pos(X), not len(accepted,X,_), not len(defeated,X,_). % Gap = draws

% Edge type calculation
% Winning (blue): Accepted node attacking Defeated node - label is attacker's length + 1
edge(winning,X,Y,B)  :- attack(X,Y), len(accepted,X,L), len(defeated,Y,_), B=L+1.
% Delaying (orange): Defeated node attacking Accepted node - label is attacker's length + 1
edge(delaying,X,Y,B) :- attack(X,Y), len(defeated,X,L), len(accepted,Y,_), B=L+1.
% Drawing (yellow): Undefined node attacking Undefined node - label is infinity
edge(drawing,X,Y,infinity)  :- attack(X,Y), len(undefined,X,_), len(undefined,Y,_).
% Blunder (gray, dotted): Suboptimal moves - no label
edge(blunder,X,Y,0)  :- attack(X,Y), len(undefined,X,_), len(defeated,Y,_).
edge(blunder,X,Y,0)  :- attack(X,Y), len(defeated,X,_), len(undefined,Y,_).
edge(blunder,X,Y,0)  :- attack(X,Y), len(defeated,X,_), len(defeated,Y,_).

#show len/3.
#show edge/4.
`
