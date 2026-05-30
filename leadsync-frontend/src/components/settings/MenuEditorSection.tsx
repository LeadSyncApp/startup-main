interface MenuItem {
  name: string;
  price: number;
}

interface Category {
  name: string;
  items: MenuItem[];
}

interface StructuredMenu {
  categories: Category[];
}

interface MenuEditorSectionProps {
  generatedMenu: StructuredMenu | null;
  updateCategoryName: (index: number, name: string) => void;
  updateItem: (
    catIndex: number,
    itemIndex: number,
    field: "name" | "price",
    value: string
  ) => void;
  addCategory: () => void;
  addItem: (catIndex: number) => void;
  deleteCategory: (index: number) => void;
  deleteItem: (catIndex: number, itemIndex: number) => void;
  saveEditedMenu: () => void;
}

export function MenuEditorSection({
  generatedMenu,
  updateCategoryName,
  updateItem,
  addCategory,
  addItem,
  deleteCategory,
  deleteItem,
  saveEditedMenu,
}: MenuEditorSectionProps) {
  if (!generatedMenu) return null;

  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-6" id="settings-menu-editor-section">
      <h2 className="text-lg font-semibold">
        Edit Menu (with Pricing)
      </h2>

      {generatedMenu.categories.map((cat: Category, cIndex: number) => (
        <div key={cIndex} className="border p-4 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <input
              value={cat.name}
              onChange={(e) =>
                updateCategoryName(cIndex, e.target.value)
              }
              className="border px-2 py-1 rounded text-sm font-semibold"
            />
            <button
              onClick={() => deleteCategory(cIndex)}
              className="text-red-500 text-xs"
            >
              Delete
            </button>
          </div>

          {cat.items.map((item: MenuItem, iIndex: number) => (
            <div key={iIndex} className="flex gap-3 items-center">
              <input
                value={item.name}
                onChange={(e) =>
                  updateItem(
                    cIndex,
                    iIndex,
                    "name",
                    e.target.value
                  )
                }
                className="flex-1 border px-2 py-1 rounded text-sm"
              />

              <input
                type="number"
                value={item.price}
                onChange={(e) =>
                  updateItem(
                    cIndex,
                    iIndex,
                    "price",
                    e.target.value
                  )
                }
                className="w-24 border px-2 py-1 rounded text-sm"
              />

              <button
                onClick={() => deleteItem(cIndex, iIndex)}
                className="text-red-400 text-xs"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            onClick={() => addItem(cIndex)}
            className="text-indigo-600 text-sm"
          >
            + Add Item
          </button>
        </div>
      ))}

      <button
        onClick={addCategory}
        className="text-indigo-600 text-sm"
      >
        + Add Category
      </button>

      <div>
        <button
          id="btn-save-menu-changes"
          onClick={saveEditedMenu}
          className="bg-green-600 text-white px-5 py-2 rounded-lg"
        >
          Save Menu Changes
        </button>
      </div>
    </div>
  );
}
