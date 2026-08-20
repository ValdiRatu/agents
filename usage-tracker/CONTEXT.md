# Usage tracking

How much of each AI subscription is left, how much was actually used in each cycle, and whether the provider moved the cap without a plan change.

## Who

**Provider**:
The company that sells the subscription and enforces its caps. Cursor, OpenAI, Anthropic.
_Avoid_: Vendor, platform, service

**Subscription**:
One entitlement with a Provider, identified by the account their usage API authenticates as. The same Claude account on two laptops is one Subscription. Personal Cursor and work Cursor are two.
_Avoid_: Account, product, integration

**Plan**:
The commercial tier of a Subscription at a point in time (Pro, Max, Plus). The Subscription persists when the Plan changes.
_Avoid_: Tier, SKU

## Caps

**Quota**:
A named cap the Provider enforces on a Subscription. It may cover all usage or a class of models (Cursor included models, Fable weekly). One Subscription has many Quotas.
_Avoid_: Limit, allowance, session

**Capacity**:
How much the Provider allows in one Cycle of a Quota, in the Provider's unit. This is the allowance, not what was used.
_Avoid_: Limit, budget, allotment, spend

**Cycle**:
One run of a Quota from window open to Reset. Two Observations mean the same Cycle when they share Subscription, Quota, and the window start the Provider reports.
_Avoid_: Session, window, period

**Observation**:
A reading of a Cycle at one moment: remaining, consumed, Capacity, and when it resets, in the Provider's unit.
_Avoid_: Snapshot, sample, poll

**Reset**:
The Provider closed a Cycle and opened another. Expected at window end, or sudden.
_Avoid_: Rollover, refresh

## Changes

**Plan change**:
The Subscription moved to a different Plan. Capacity may move with it.
_Avoid_: Upgrade, downgrade

**Policy change**:
Capacity moved without a Plan change. Promotion or silent nerf. When the Provider only reports remaining as a percentage, this is inferred from different Spend at Cycle end under the same Plan.
_Avoid_: Limit change, session limit change, nerf

## Usage

**Spend**:
Tokens actually moved during a Cycle, split into input, output, cache read, and cache write. Not remaining, and not Capacity.
_Avoid_: Usage, consumption

**Billing period**:
The Provider's charging window for a Subscription, usually monthly. Distinct from a Quota Cycle. Several weekly Cycles can sit inside one Billing period.
_Avoid_: Period, month, invoice, cycle

**Overage**:
Money charged beyond included Capacity during a Billing period. What usage APIs report as extra or pay-as-you-go spend.
_Avoid_: Extra, PAYG, on-demand
