import { type NextPage } from "next";
import React, { useEffect, useState } from "react";

import type { ColumnDef, RowData } from "@tanstack/react-table";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { api } from "../utils/api";
import type { Person } from "@prisma/client";
import { supabaseClient } from "../utils/supabase";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (id: string, field: string, value: unknown) => void;
  }
}

const CreatePerson = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState<number | string>("");

  const query = api.useContext();
  const { mutate: createPerson, isLoading } = api.person.create.useMutation({
    onMutate: async (newPerson) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await query.person.getAll.cancel();

      // Snapshot the previous value
      const prevData = query.person.getAll.getData();

      // Optimistically update to the new value
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      query.person.getAll.setData(undefined, (old) => [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...(old as any),
        { ...newPerson, id: "random" },
      ]);

      // Return a context object with the snapshotted value
      return { prevData };
    },
    // If the mutation fails,
    // use the context returned from onMutate to roll back
    onError: (err, newTodo, context) => {
      query.person.getAll.setData(undefined, context?.prevData);
    },
    // Always refetch after error or success:
    onSettled: async () => {
      await query.person.invalidate();
    },
  });

  const onSubmit = () => {
    createPerson(
      {
        age: age as number,
        firstName,
        lastName,
      },
      {
        onSuccess: () => {
          setFirstName("");
          setLastName("");
          setAge("");
        },
      }
    );
  };

  return (
    <div>
      <input
        placeholder="name"
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        placeholder="last name"
        type="text"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <input
        placeholder="age"
        type="text"
        value={age.toString()}
        onChange={(e) => setAge(+e.target.value)}
      />
      <button onClick={onSubmit} disabled={isLoading}>
        {isLoading ? "creating" : "Submit"}
      </button>
    </div>
  );
};

// Give our default column cell renderer editing superpowers!
const defaultColumn: Partial<ColumnDef<Person>> = {
  cell: ({
    getValue,
    row: {
      original: { id },
    },
    column: { id: field },
    table,
  }) => {
    const initialValue = getValue();
    // We need to keep and update the state of the cell normally
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = React.useState(initialValue);

    // When the input is blurred, we'll call our table meta's updateData function
    const onBlur = () => {
      table.options.meta?.updateData(id, field, value);
    };

    // If the initialValue is changed external, sync it up with our state
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    return (
      <input
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
      />
    );
  },
};

function useSkipper() {
  const shouldSkipRef = React.useRef(true);
  const shouldSkip = shouldSkipRef.current;

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = React.useCallback(() => {
    shouldSkipRef.current = false;
  }, []);

  React.useEffect(() => {
    shouldSkipRef.current = true;
  });

  return [shouldSkip, skip] as const;
}

const Home: NextPage = () => {
  const { data: persons } = api.person.getAll.useQuery();
  const { mutate: updatePerson } = api.person.update.useMutation();

  const query = api.useContext();

  useEffect(() => {
    supabaseClient
      .channel("custom-all-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Person" },
        (payload) => {
          console.log("Change received!", payload);
          void query.person.getAll.invalidate();
        }
      )
      .subscribe();
  }, []);

  const columns = React.useMemo<ColumnDef<Person>[]>(
    () => [
      { accessorKey: "firstName", header: "Name" },
      { accessorKey: "lastName", header: "Last Name" },
      { accessorKey: "age", header: "Age" },
    ],
    []
  );

  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  const table = useReactTable({
    data: persons || [],
    columns,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex,
    // Provide our updateData function to our table meta
    meta: {
      updateData: (id, field, value) => {
        // Skip age index reset until after next rerender
        skipAutoResetPageIndex();

        updatePerson({
          id,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: { field: field as any, value: value as any },
        });

        // setData((old) =>
        //   old.map((row, index) => {
        //     if (index === rowIndex) {
        //       return {
        //         ...old[rowIndex]!,
        //         [columnId]: value,
        //       };
        //     }
        //     return row;
        //   })
        // );
      },
    },
    debugTable: true,
  });
  return (
    <div className="p-2">
      <div>
        <CreatePerson />
      </div>
      <div className="h-2" />
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border border-slate-100">
              {headerGroup.headers.map((header) => {
                return (
                  <th key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id} className="border border-slate-200">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Home;
