We're writing a plugin for Joplin that will assume the note's contents are a CSV file and will display it in a nice grid. 

You will NOT make all parts at once; we'll go through these phases and I will have to OK every one. 

# Target state: 
- user can click a button in the Tools menu to mark a note as CSV. 
- When the user opens a note marked as CSV, it will be rendered as a table and an extra toggle button in the editor menu will be added.
  - On clicking, this button will toggle between the CSV view and plaintext view
- We always assume the first row is a header with names
- We will make best guesses on data types and display the table nicely
- User will be able to store separator 

# Coding style:
- curly braces always go on new lines

# Phases 

## Button

I have installed the `ag-grid-community` library - use that for the table functionality. 

First thing to do - the toolbar button in the editor. For now only make it trigger a console.log command to show that it works. Name it "Toggle CSV view". 

## Rudimentary CSV display

Now when the user clicks the button, the display should change - load the contents of the note as a ";" separated CSV.
Treat all columns as simple strings. 



## Settings

Create a Joplin settings section that will have these settings: 

1. "Default separator". Default value is ";".
2. "Default string escape". Default value is a double-quote " 

## Per note config storage

1. Whether or not the note is a CSV will be stored in userdata (`joplin.data.userDataSet`). 
2. The CSV flag will be called `is-csv`
3. The delimiter will be called `delimiter` and will default to the value of "Default Separator" setting.
4. The string delimiter will be called `escape` and will default to the appropriate setting as well

This is the flow: 

On every note, the plugin is inactive by default. It checks the note's userData value of `is-csv`. If it's missing or is not `true`, the plugin does nothing and the CSV view isn't used. Move the check  to the top of the flow so we ain't wasting time if there's nothing to be done. 
If it is present, it shows the note in the CSV mode.

Clicking the 'CSV' button in the note toolbar turns on the view and sets the `is-csv` to true. 

The point is to automatically see marked CSVs in this view, and not touch anything else.
