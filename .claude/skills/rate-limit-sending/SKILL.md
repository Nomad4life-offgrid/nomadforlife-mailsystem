---
name: rate-limit-sending
description: Legt regels vast voor batchverzending, wachttijden en veilige spreiding van e-mailverkeer.
---

Gebruik deze skill voor beheerst verzenden.

Uitgangspunten:

- maximaal 100 mails per batch
- korte wachttijd tussen batches
- queue-benadering bij grotere volumes
- retries alleen bij geschikte fouttypes

Belangrijke regels:

- voorkom piekverzending zonder controle
- bouw batches expliciet op
- leg verzendstatus per batch vast
- voorkom dubbele verzending
- controleer vóór verzending of contact nog verzendbaar is

Werk altijd met een veilige en voorspelbare verzendstroom.