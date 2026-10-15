import { getMedicines } from "@/lib/queries";
import { addMedicineAction, restockMedicineAction } from "@/server/actions";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function MedicinesPage() {
  const medicines = await getMedicines();
  const low = medicines.filter((m) => m.stock < 10).length;

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.03em]">Medicines</h1>
          <p className="mt-1 text-mute">
            The <span className="font-mono text-xs">trg_item_insert</span> trigger pulls one
            unit of stock each time a prescription item is written; a{" "}
            <span className="font-mono text-xs">CHECK (stock ≥ 0)</span> keeps it sane.
          </p>
        </div>
        {low > 0 && <Badge tone="yellow">{low} below threshold</Badge>}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Restock</Th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m.medicine_id} className="hover:bg-bone">
                <Td>{m.name}</Td>
                <Td className="tabular-nums">₹{Number(m.price).toFixed(2)}</Td>
                <Td>
                  {m.stock < 10 ? (
                    <Badge tone="red">{m.stock} low</Badge>
                  ) : (
                    <span className="tabular-nums text-mute">{m.stock}</span>
                  )}
                </Td>
                <Td>
                  <form action={restockMedicineAction} className="flex items-center gap-2">
                    <input type="hidden" name="medicine_id" value={m.medicine_id} />
                    <Input name="qty" type="number" min="1" placeholder="10" className="w-20 py-1" />
                    <Button variant="outline" className="py-1.5">
                      Add
                    </Button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <aside>
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="font-serif text-lg tracking-[-0.02em]">Add medicine</h2>
            <form action={addMedicineAction} className="mt-4 space-y-4">
              <Field label="Name">
                <Input name="name" required placeholder="e.g. Ibuprofen 400mg" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (₹)">
                  <Input name="price" type="number" step="0.01" min="0" required />
                </Field>
                <Field label="Opening stock">
                  <Input name="stock" type="number" min="0" required />
                </Field>
              </div>
              <Button className="w-full">Add to inventory</Button>
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}
